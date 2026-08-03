
-- 1. Suspension metadata
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspension_reason text,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

CREATE OR REPLACE FUNCTION public.is_suspended(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE((SELECT suspended FROM public.profiles WHERE id=_uid), false);
$$;
GRANT EXECUTE ON FUNCTION public.is_suspended(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.admin_set_suspended(uuid, boolean);
CREATE OR REPLACE FUNCTION public.admin_set_suspended(_user_id uuid, _suspended boolean, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  UPDATE public.profiles
    SET suspended=_suspended,
        suspension_reason = CASE WHEN _suspended THEN NULLIF(trim(COALESCE(_reason,'')),'') ELSE NULL END,
        suspended_at = CASE WHEN _suspended THEN now() ELSE NULL END
    WHERE id=_user_id;
  INSERT INTO public.notifications(user_id,type,title,body,link)
    VALUES (_user_id,'system',
      CASE WHEN _suspended THEN 'Account suspended' ELSE 'Account reactivated' END,
      CASE WHEN _suspended THEN COALESCE(NULLIF(trim(COALESCE(_reason,'')),''),'Your account has been suspended by an administrator.')
           ELSE 'Your account has been reactivated. Welcome back.' END,
      CASE WHEN _suspended THEN '/suspended' ELSE '/dashboard' END);
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(), CASE WHEN _suspended THEN 'suspend_user' ELSE 'unsuspend_user' END,'profiles',_user_id,
      jsonb_build_object('reason',_reason));
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_set_suspended(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_account_status()
RETURNS TABLE(suspended boolean, suspension_reason text, suspended_at timestamptz, withdrawal_hold boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.suspended, p.suspension_reason, p.suspended_at, p.withdrawal_hold
  FROM public.profiles p WHERE p.id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_account_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_account_status() TO authenticated;

-- 2. Server-side suspension guards on user action RPCs
CREATE OR REPLACE FUNCTION public.submit_task(_task_id uuid, _proof_text text, _proof_url text, _attachments jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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

CREATE OR REPLACE FUNCTION public.submit_kyc(_id_front text, _id_back text, _selfie text, _paypal_email text, _phone text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public.is_suspended(auth.uid()) THEN RAISE EXCEPTION 'Account is suspended'; END IF;
  IF EXISTS (SELECT 1 FROM public.kyc_verifications WHERE user_id=auth.uid() AND status='approved') THEN
    RAISE EXCEPTION 'Identity already verified';
  END IF;
  IF EXISTS (SELECT 1 FROM public.kyc_verifications WHERE user_id=auth.uid() AND status='pending') THEN
    RAISE EXCEPTION 'A verification is already pending review';
  END IF;
  IF coalesce(trim(_paypal_email),'')='' OR coalesce(trim(_phone),'')='' THEN RAISE EXCEPTION 'PayPal email and phone are required'; END IF;
  INSERT INTO public.kyc_verifications(user_id,id_front_path,id_back_path,selfie_path,paypal_email,phone)
    VALUES (auth.uid(),_id_front,_id_back,_selfie,lower(trim(_paypal_email)),trim(_phone))
    RETURNING id INTO new_id;
  INSERT INTO public.notifications(user_id,type,title,body,link)
    VALUES (auth.uid(),'system','Verification submitted','Your identity verification is under review. This usually takes up to 48 hours.','/verification');
  INSERT INTO public.notifications(user_id,type,title,body,link)
  SELECT ur.user_id,'system'::public.notification_type,'New identity verification','A user submitted identity documents for review.','/admin/verification'
  FROM public.user_roles ur WHERE ur.role IN ('super_admin','admin')
  UNION
  SELECT sp.user_id,'system'::public.notification_type,'New identity verification','A user submitted identity documents for review.','/admin/verification'
  FROM public.staff_permissions sp WHERE sp.permission='approve_withdrawals';
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'kyc_submitted','kyc_verifications',new_id,'{}'::jsonb);
  RETURN new_id;
END; $function$;

-- 3. Announcement publishing with fan-out to notifications
CREATE OR REPLACE FUNCTION public.admin_publish_announcement(_title text, _body text, _audience text DEFAULT 'all')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE new_id uuid; recipients integer;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF coalesce(trim(_title),'')='' THEN RAISE EXCEPTION 'Title required'; END IF;
  IF _audience NOT IN ('all','users','staff') THEN RAISE EXCEPTION 'Invalid audience'; END IF;
  INSERT INTO public.announcements(title, body, audience, published_at, created_by)
    VALUES (trim(_title), COALESCE(_body,''), _audience, now(), auth.uid())
    RETURNING id INTO new_id;

  WITH targets AS (
    SELECT p.id FROM public.profiles p
    WHERE CASE
      WHEN _audience='staff' THEN public.is_staff(p.id)
      WHEN _audience='users' THEN NOT public.is_staff(p.id)
      ELSE true END
  )
  INSERT INTO public.notifications(user_id,type,title,body,link)
  SELECT t.id,'announcement'::public.notification_type, trim(_title), NULLIF(COALESCE(_body,''),''), '/notifications'
  FROM targets t;
  GET DIAGNOSTICS recipients = ROW_COUNT;

  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'publish_announcement','announcements',new_id,jsonb_build_object('recipients',recipients,'audience',_audience));
  RETURN new_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_publish_announcement(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_publish_announcement(text,text,text) TO authenticated;

-- 4. Users can read published announcements addressed to them
DROP POLICY IF EXISTS "announcements_read_published" ON public.announcements;
CREATE POLICY "announcements_read_published" ON public.announcements
  FOR SELECT TO authenticated
  USING (
    published_at IS NOT NULL AND (
      audience = 'all'
      OR (audience = 'staff' AND public.is_staff(auth.uid()))
      OR (audience = 'users' AND NOT public.is_staff(auth.uid()))
    )
  );

-- 5. Realtime for live notification + suspension push
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
