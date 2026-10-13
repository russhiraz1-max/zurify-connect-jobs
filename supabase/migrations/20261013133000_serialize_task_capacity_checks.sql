-- Serialize capacity checks by locking the parent task row. Concurrent
-- apply/submit calls for the same task wait for one another, then recount
-- capacity against the latest committed rows. Test concurrency on an isolated
-- database before using this migration anywhere production-like.

CREATE OR REPLACE FUNCTION public.apply_to_task(_task_id uuid, _note text DEFAULT NULL, _cover_letter text DEFAULT NULL, _experience text DEFAULT NULL, _cv_path text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t RECORD; existing RECORD; app_count integer; new_id uuid; p RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT suspended INTO p FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF p.suspended THEN RAISE EXCEPTION 'Account is suspended'; END IF;
  -- Keep client, advertiser and privileged accounts out of worker execution
  -- paths. Legacy user-only accounts are backfilled to job_seeker by the
  -- account-type migration; new OAuth accounts must complete onboarding first.
  IF NOT public.has_role(auth.uid(), 'job_seeker'::public.app_role)
     OR public.has_role(auth.uid(), 'employer'::public.app_role)
     OR public.has_role(auth.uid(), 'staff'::public.app_role)
     OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
     OR public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'advertiser'::public.app_role) THEN
    RAISE EXCEPTION 'Freelancer account required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO t FROM public.tasks WHERE id=_task_id AND status='published' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not available'; END IF;
  IF t.ends_at IS NOT NULL AND now()>t.ends_at THEN RAISE EXCEPTION 'Task ended'; END IF;

  IF EXISTS (SELECT 1 FROM public.task_submissions
             WHERE task_id=_task_id AND user_id=auth.uid() AND status='approved') THEN
    RAISE EXCEPTION 'You have already completed this job';
  END IF;
  IF NOT t.allow_reapplication AND EXISTS (SELECT 1 FROM public.task_submissions
             WHERE task_id=_task_id AND user_id=auth.uid() AND status='rejected') THEN
    RAISE EXCEPTION 'This job was closed for you after review';
  END IF;

  SELECT * INTO existing FROM public.task_applications
    WHERE task_id=_task_id AND user_id=auth.uid() ORDER BY created_at DESC LIMIT 1;
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
  INSERT INTO public.notifications(user_id,type,title,body,link)
  SELECT ur.user_id,'application_received'::public.notification_type,
         'New application','A user applied for "'||t.title||'".','/admin/applications'
  FROM public.user_roles ur WHERE ur.role IN ('super_admin','admin')
  UNION
  SELECT sp.user_id,'application_received'::public.notification_type,
         'New application','A user applied for "'||t.title||'".','/admin/applications'
  FROM public.staff_permissions sp WHERE sp.permission='review_applications';
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'apply_to_task','task_applications',new_id,jsonb_build_object('task_id',_task_id));
  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.submit_task(_task_id uuid, _proof_text text DEFAULT NULL, _proof_url text DEFAULT NULL, _attachments jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t RECORD; my_count integer; total_count integer; sub_id uuid; approved_app integer; p RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT suspended INTO p FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF p.suspended THEN RAISE EXCEPTION 'Account is suspended'; END IF;
  SELECT * INTO t FROM public.tasks WHERE id=_task_id AND status='published' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not available'; END IF;
  IF t.starts_at IS NOT NULL AND now()<t.starts_at THEN RAISE EXCEPTION 'Task not started yet'; END IF;
  IF t.ends_at IS NOT NULL AND now()>t.ends_at THEN RAISE EXCEPTION 'Task ended'; END IF;
  IF t.requires_application THEN
    SELECT count(*) INTO approved_app FROM public.task_applications
      WHERE task_id=_task_id AND user_id=auth.uid() AND status='approved';
    IF approved_app = 0 THEN RAISE EXCEPTION 'You must be approved before submitting this task'; END IF;
  END IF;
  IF NOT t.allow_reapplication AND EXISTS (SELECT 1 FROM public.task_submissions
       WHERE task_id=_task_id AND user_id=auth.uid() AND status='rejected') THEN
    RAISE EXCEPTION 'This submission was rejected and resubmission is not allowed';
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
END; $$;
