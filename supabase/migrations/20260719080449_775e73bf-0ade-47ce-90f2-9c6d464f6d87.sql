
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS requires_application boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_reapplication boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_applications integer;

CREATE TABLE IF NOT EXISTS public.task_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.application_status NOT NULL DEFAULT 'pending',
  note text,
  reviewer_id uuid REFERENCES auth.users(id),
  review_notes text,
  rejection_reason text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.task_applications TO authenticated;
GRANT ALL ON public.task_applications TO service_role;

ALTER TABLE public.task_applications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS task_applications_task_idx ON public.task_applications(task_id);
CREATE INDEX IF NOT EXISTS task_applications_user_idx ON public.task_applications(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS task_applications_active_unique
  ON public.task_applications(task_id, user_id)
  WHERE status IN ('pending','approved');

DROP POLICY IF EXISTS "Users read own applications" ON public.task_applications;
CREATE POLICY "Users read own applications" ON public.task_applications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR public.has_staff_permission(auth.uid(),'review_applications'));

DROP POLICY IF EXISTS "Staff or user update applications" ON public.task_applications;
CREATE POLICY "Staff or user update applications" ON public.task_applications
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid())
    OR public.has_staff_permission(auth.uid(),'review_applications')
    OR user_id = auth.uid())
  WITH CHECK (public.is_super_admin(auth.uid())
    OR public.has_staff_permission(auth.uid(),'review_applications')
    OR user_id = auth.uid());

DROP TRIGGER IF EXISTS update_task_applications_updated_at ON public.task_applications;
CREATE TRIGGER update_task_applications_updated_at BEFORE UPDATE ON public.task_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.apply_to_task(_task_id uuid, _note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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

  INSERT INTO public.task_applications(task_id,user_id,note)
    VALUES (_task_id, auth.uid(), _note) RETURNING id INTO new_id;

  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'apply_to_task','task_applications',new_id,jsonb_build_object('task_id',_task_id));
  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_application(_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE a RECORD;
BEGIN
  SELECT * INTO a FROM public.task_applications WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  IF a.user_id <> auth.uid() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF a.status <> 'pending' THEN RAISE EXCEPTION 'Only pending applications can be cancelled'; END IF;
  UPDATE public.task_applications SET status='cancelled' WHERE id=_id;
END; $$;

CREATE OR REPLACE FUNCTION public.approve_application(_id uuid, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE a RECORD; t RECORD;
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_staff_permission(auth.uid(),'review_applications')) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO a FROM public.task_applications WHERE id=_id FOR UPDATE;
  IF NOT FOUND OR a.status <> 'pending' THEN RAISE EXCEPTION 'Application not pending'; END IF;
  SELECT * INTO t FROM public.tasks WHERE id=a.task_id;
  UPDATE public.task_applications
    SET status='approved', reviewer_id=auth.uid(), review_notes=_notes, reviewed_at=now()
    WHERE id=_id;
  INSERT INTO public.notifications(user_id,type,title,body,link)
    VALUES (a.user_id,'application_approved','Application approved',
      'You have been approved for "'||t.title||'". You can now complete the task.','/applications');
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'approve_application','task_applications',_id,jsonb_build_object('task_id',a.task_id));
END; $$;

CREATE OR REPLACE FUNCTION public.reject_application(_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE a RECORD; t RECORD;
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_staff_permission(auth.uid(),'review_applications')) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO a FROM public.task_applications WHERE id=_id FOR UPDATE;
  IF NOT FOUND OR a.status <> 'pending' THEN RAISE EXCEPTION 'Application not pending'; END IF;
  SELECT * INTO t FROM public.tasks WHERE id=a.task_id;
  UPDATE public.task_applications
    SET status='rejected', reviewer_id=auth.uid(), rejection_reason=_reason, reviewed_at=now()
    WHERE id=_id;
  INSERT INTO public.notifications(user_id,type,title,body,link)
    VALUES (a.user_id,'application_rejected','Application rejected',
      'Application for "'||t.title||'" was rejected: '||COALESCE(_reason,''),'/applications');
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'reject_application','task_applications',_id,jsonb_build_object('reason',_reason));
END; $$;

CREATE OR REPLACE FUNCTION public.submit_task(_task_id uuid, _proof_text text, _proof_url text, _attachments jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE t RECORD; my_count integer; total_count integer; sub_id uuid; approved_app integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO t FROM public.tasks WHERE id=_task_id AND status='published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not available'; END IF;
  IF t.starts_at IS NOT NULL AND now()<t.starts_at THEN RAISE EXCEPTION 'Task not started yet'; END IF;
  IF t.ends_at IS NOT NULL AND now()>t.ends_at THEN RAISE EXCEPTION 'Task ended'; END IF;

  IF t.requires_application THEN
    SELECT count(*) INTO approved_app FROM public.task_applications
      WHERE task_id=_task_id AND user_id=auth.uid() AND status='approved';
    IF approved_app = 0 THEN RAISE EXCEPTION 'You must be approved before submitting this task'; END IF;
  END IF;

  SELECT count(*) INTO my_count FROM public.task_submissions
    WHERE task_id=_task_id AND user_id=auth.uid() AND status IN ('pending','approved');
  IF my_count>=t.max_per_user THEN RAISE EXCEPTION 'Submission limit reached for this task'; END IF;
  IF t.max_total IS NOT NULL THEN
    SELECT count(*) INTO total_count FROM public.task_submissions
      WHERE task_id=_task_id AND status IN ('pending','approved');
    IF total_count>=t.max_total THEN RAISE EXCEPTION 'Task fully claimed'; END IF;
  END IF;
  INSERT INTO public.task_submissions (task_id,user_id,proof_text,proof_url,attachments)
    VALUES (_task_id,auth.uid(),_proof_text,_proof_url,COALESCE(_attachments,'[]'::jsonb)) RETURNING id INTO sub_id;
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'submit_task','task_submissions',sub_id,jsonb_build_object('task_id',_task_id));
  RETURN sub_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.apply_to_task(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_application(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_application(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_application(uuid, text) TO authenticated;
