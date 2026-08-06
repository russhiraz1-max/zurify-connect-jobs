-- 1. apply_to_task: block re-application once the job has already been completed
CREATE OR REPLACE FUNCTION public.apply_to_task(_task_id uuid, _note text DEFAULT NULL, _cover_letter text DEFAULT NULL, _experience text DEFAULT NULL, _cv_path text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t RECORD; existing RECORD; app_count integer; new_id uuid; p RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT suspended INTO p FROM public.profiles WHERE id=auth.uid();
  IF p.suspended THEN RAISE EXCEPTION 'Account is suspended'; END IF;
  SELECT * INTO t FROM public.tasks WHERE id=_task_id AND status='published';
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

-- 2. submit_task: a permanently rejected submission closes the job for that member
CREATE OR REPLACE FUNCTION public.submit_task(_task_id uuid, _proof_text text DEFAULT NULL, _proof_url text DEFAULT NULL, _attachments jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t RECORD; my_count integer; total_count integer; sub_id uuid; approved_app integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public.is_suspended(auth.uid()) THEN RAISE EXCEPTION 'Account is suspended'; END IF;
  SELECT * INTO t FROM public.tasks WHERE id=_task_id AND status='published';
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

-- 3. admin_set_pro_status: allow the awaiting_kyc holding state
CREATE OR REPLACE FUNCTION public.admin_set_pro_status(_id uuid, _status text, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF _status NOT IN ('pending','active','rejected','suspended','expired','awaiting_kyc') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  SELECT * INTO r FROM public.pro_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  UPDATE public.pro_requests SET status=_status, admin_notes=_notes, reviewer_id=auth.uid(),
    activated_at = CASE WHEN _status='active' THEN now() ELSE activated_at END,
    expires_at = CASE WHEN _status='active' THEN now() + (duration_days||' days')::interval ELSE expires_at END
    WHERE id=_id;
  INSERT INTO public.notifications(user_id,type,title,body,link)
    VALUES (r.user_id,'system',
      CASE WHEN _status='awaiting_kyc' THEN 'Zurify Pro awaiting verification' ELSE 'Zurify Pro '||_status END,
      CASE WHEN _status='awaiting_kyc'
        THEN 'Complete identity verification to activate your Zurify Pro benefits.'
        ELSE 'Your Zurify Pro membership is now '||_status||'.' END,
      CASE WHEN _status='awaiting_kyc' THEN '/verification' ELSE '/pro' END);
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'pro_'||_status,'pro_requests',_id,jsonb_build_object('user_id',r.user_id));
END; $$;

-- 4. admin_approve_kyc: auto-activate any Pro membership held for verification
CREATE OR REPLACE FUNCTION public.admin_approve_kyc(_id uuid, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k RECORD; pr RECORD;
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_staff_permission(auth.uid(),'approve_withdrawals')) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO k FROM public.kyc_verifications WHERE id=_id FOR UPDATE;
  IF NOT FOUND OR k.status<>'pending' THEN RAISE EXCEPTION 'Verification not pending'; END IF;
  UPDATE public.kyc_verifications SET status='approved',reviewer_id=auth.uid(),reviewed_at=now(),admin_notes=_notes WHERE id=_id;
  INSERT INTO public.notifications(user_id,type,title,body,link)
    VALUES (k.user_id,'account_verified','Identity verification approved','You may now receive withdrawals.','/withdrawals');
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'kyc_approved','kyc_verifications',_id,jsonb_build_object('user_id',k.user_id));

  FOR pr IN SELECT * FROM public.pro_requests WHERE user_id=k.user_id AND status='awaiting_kyc' FOR UPDATE LOOP
    UPDATE public.pro_requests
      SET status='active', activated_at=now(), expires_at=now() + (pr.duration_days||' days')::interval
      WHERE id=pr.id;
    INSERT INTO public.notifications(user_id,type,title,body,link)
      VALUES (k.user_id,'system','Zurify Pro activated','Identity verified — your Zurify Pro benefits are now active.','/pro');
    INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
      VALUES (auth.uid(),'pro_auto_activated','pro_requests',pr.id,jsonb_build_object('user_id',k.user_id));
  END LOOP;
END; $$;