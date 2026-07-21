
ALTER TABLE public.task_applications
  ADD COLUMN IF NOT EXISTS cover_letter text,
  ADD COLUMN IF NOT EXISTS experience text,
  ADD COLUMN IF NOT EXISTS cv_path text;

-- Broaden read policy on submission-proofs to include application reviewers
DROP POLICY IF EXISTS "Users read own proofs" ON storage.objects;
CREATE POLICY "Users read own proofs" ON storage.objects FOR SELECT
USING (
  bucket_id = 'submission-proofs' AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.is_super_admin(auth.uid())
    OR public.has_staff_permission(auth.uid(), 'review_submissions')
    OR public.has_staff_permission(auth.uid(), 'review_applications')
  )
);

-- Replace apply_to_task with richer signature (drop old first to change args)
DROP FUNCTION IF EXISTS public.apply_to_task(uuid, text);
DROP FUNCTION IF EXISTS public.apply_to_task(uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION public.apply_to_task(
  _task_id uuid,
  _note text DEFAULT NULL,
  _cover_letter text DEFAULT NULL,
  _experience text DEFAULT NULL,
  _cv_path text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE t RECORD; existing RECORD; app_count integer; new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO t FROM public.tasks WHERE id=_task_id AND status='published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not available'; END IF;
  IF t.ends_at IS NOT NULL AND now()>t.ends_at THEN RAISE EXCEPTION 'Task ended'; END IF;

  SELECT * INTO existing FROM public.task_applications
    WHERE task_id=_task_id AND user_id=auth.uid()
    ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    IF existing.status IN ('pending','approved') THEN
      RAISE EXCEPTION 'You already have an active application for this task';
    ELSIF existing.status='rejected' AND NOT t.allow_reapplication THEN
      RAISE EXCEPTION 'Re-application not allowed for this task';
    END IF;
  END IF;

  IF t.max_applications IS NOT NULL THEN
    SELECT count(*) INTO app_count FROM public.task_applications
      WHERE task_id=_task_id AND status IN ('pending','approved');
    IF app_count >= t.max_applications THEN RAISE EXCEPTION 'Applications closed'; END IF;
  END IF;

  INSERT INTO public.task_applications(task_id,user_id,note,cover_letter,experience,cv_path)
    VALUES (_task_id, auth.uid(), _note, _cover_letter, _experience, _cv_path)
    RETURNING id INTO new_id;

  -- Notify staff/admins with review_applications permission
  INSERT INTO public.notifications(user_id,type,title,body,link)
  SELECT ur.user_id,'application_received'::public.notification_type,
         'New application','A user applied for "'||t.title||'".','/admin/applications'
  FROM public.user_roles ur
  WHERE ur.role IN ('super_admin','admin')
  UNION
  SELECT sp.user_id,'application_received'::public.notification_type,
         'New application','A user applied for "'||t.title||'".','/admin/applications'
  FROM public.staff_permissions sp
  WHERE sp.permission='review_applications';

  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'apply_to_task','task_applications',new_id,jsonb_build_object('task_id',_task_id));
  RETURN new_id;
END; $function$;

REVOKE EXECUTE ON FUNCTION public.apply_to_task(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_to_task(uuid, text, text, text, text) TO authenticated;

-- Ensure notification type exists for application_received
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid
                 WHERE t.typname='notification_type' AND e.enumlabel='application_received') THEN
    ALTER TYPE public.notification_type ADD VALUE 'application_received';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid
                 WHERE t.typname='notification_type' AND e.enumlabel='submission_received') THEN
    ALTER TYPE public.notification_type ADD VALUE 'submission_received';
  END IF;
END$$;
