
CREATE OR REPLACE FUNCTION public.submit_task(_task_id uuid, _proof_text text, _proof_url text, _attachments jsonb)
 RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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

  INSERT INTO public.notifications(user_id,type,title,body,link)
  SELECT ur.user_id,'submission_received'::public.notification_type,
         'New submission','A user submitted proof for "'||t.title||'".','/admin/submissions'
  FROM public.user_roles ur WHERE ur.role IN ('super_admin','admin')
  UNION
  SELECT sp.user_id,'submission_received'::public.notification_type,
         'New submission','A user submitted proof for "'||t.title||'".','/admin/submissions'
  FROM public.staff_permissions sp WHERE sp.permission='review_submissions';

  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'submit_task','task_submissions',sub_id,jsonb_build_object('task_id',_task_id));
  RETURN sub_id;
END; $function$;

REVOKE EXECUTE ON FUNCTION public.submit_task(uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_task(uuid, text, text, jsonb) TO authenticated;
