
-- 1. Extend enums
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'withdrawal_requested';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'withdrawal_hold_enabled';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'withdrawal_hold_removed';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'reward_credited';

-- 2. Wallet pending withdrawal column
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS pending_withdrawal_cents integer NOT NULL DEFAULT 0 CHECK (pending_withdrawal_cents >= 0);

-- 3. Profile suspension + withdrawal hold
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS withdrawal_hold boolean NOT NULL DEFAULT false;

-- 4. Tighten application_settings (revoke any anon)
REVOKE ALL ON public.application_settings FROM anon;
REVOKE ALL ON public.application_settings FROM PUBLIC;
GRANT SELECT, UPDATE ON public.application_settings TO authenticated;
GRANT ALL ON public.application_settings TO service_role;

-- 5. Remove bootstrap-staff-email auto assignment; keep super admin auto assignment
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE s RECORD; assigned public.app_role := 'user';
BEGIN
  SELECT * INTO s FROM public.application_settings WHERE singleton=true LIMIT 1;
  INSERT INTO public.profiles (id, full_name, avatar_url) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.wallets (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  IF s.super_admin_email IS NOT NULL AND lower(NEW.email)=lower(s.super_admin_email) THEN
    assigned := 'super_admin';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned) ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;

-- 6. Rework withdrawal RPCs with reservation semantics
CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount_cents integer, _method withdrawal_method, _destination jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE s RECORD; w RECORD; p RECORD; fee integer; net integer; wid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT suspended, withdrawal_hold INTO p FROM public.profiles WHERE id=auth.uid();
  IF p.suspended THEN RAISE EXCEPTION 'Account is suspended'; END IF;
  IF p.withdrawal_hold THEN RAISE EXCEPTION 'Withdrawals are currently on hold for your account'; END IF;
  SELECT * INTO s FROM public.application_settings WHERE singleton=true;
  IF _amount_cents < s.min_withdrawal_cents THEN RAISE EXCEPTION 'Below minimum withdrawal'; END IF;
  IF _amount_cents % s.withdrawal_unit_cents <> 0 THEN RAISE EXCEPTION 'Amount must be a multiple'; END IF;
  SELECT * INTO w FROM public.wallets WHERE user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND OR w.available_cents < _amount_cents THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  fee := (floor(_amount_cents::numeric/s.withdrawal_unit_cents)::integer * s.withdrawal_unit_cents * s.fee_bps_per_unit / 10000)::integer;
  net := _amount_cents - fee;
  -- Reserve funds
  UPDATE public.wallets SET available_cents = available_cents - _amount_cents,
                             pending_withdrawal_cents = pending_withdrawal_cents + _amount_cents
    WHERE id = w.id;
  INSERT INTO public.withdrawal_requests(user_id,method,destination,amount_cents,fee_cents,net_cents)
    VALUES (auth.uid(),_method,COALESCE(_destination,'{}'::jsonb),_amount_cents,fee,net) RETURNING id INTO wid;
  INSERT INTO public.notifications(user_id,type,title,body,link)
    VALUES (auth.uid(),'withdrawal_requested','Withdrawal received',
      'Your request for $'||to_char(net/100.0,'FM999999999.00')||' will be processed within 48 hours.','/withdrawals');
  -- notify super admins & staff with approve_withdrawals
  INSERT INTO public.notifications(user_id,type,title,body,link)
  SELECT ur.user_id,'withdrawal_requested'::public.notification_type,
         'New withdrawal request','A user requested $'||to_char(_amount_cents/100.0,'FM999999999.00')||'.','/admin/withdrawals'
  FROM public.user_roles ur WHERE ur.role IN ('super_admin','admin')
  UNION
  SELECT sp.user_id,'withdrawal_requested'::public.notification_type,
         'New withdrawal request','A user requested $'||to_char(_amount_cents/100.0,'FM999999999.00')||'.','/admin/withdrawals'
  FROM public.staff_permissions sp WHERE sp.permission='approve_withdrawals';
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'request_withdrawal','withdrawal_requests',wid,jsonb_build_object('amount_cents',_amount_cents));
  RETURN wid;
END; $$;

CREATE OR REPLACE FUNCTION public.approve_withdrawal(_id uuid, _notes text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r RECORD; w RECORD; new_bal integer;
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_staff_permission(auth.uid(),'approve_withdrawals')) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.withdrawal_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND OR r.status<>'pending' THEN RAISE EXCEPTION 'Withdrawal not pending'; END IF;
  SELECT * INTO w FROM public.wallets WHERE user_id=r.user_id FOR UPDATE;
  IF w.pending_withdrawal_cents < r.amount_cents THEN RAISE EXCEPTION 'Reserve mismatch'; END IF;
  UPDATE public.wallets SET pending_withdrawal_cents = pending_withdrawal_cents - r.amount_cents,
                             lifetime_withdrawn_cents = lifetime_withdrawn_cents + r.amount_cents
    WHERE id = w.id
    RETURNING available_cents INTO new_bal;
  INSERT INTO public.wallet_transactions(wallet_id,user_id,type,amount_cents,balance_after_cents,reference_type,reference_id,memo)
    VALUES (w.id,r.user_id,'withdrawal',-r.amount_cents,new_bal,'withdrawal_requests',r.id,'Withdrawal approved');
  IF r.fee_cents>0 THEN
    INSERT INTO public.wallet_transactions(wallet_id,user_id,type,amount_cents,balance_after_cents,reference_type,reference_id,memo)
      VALUES (w.id,r.user_id,'fee',-r.fee_cents,new_bal,'withdrawal_requests',r.id,'Withdrawal service fee');
  END IF;
  UPDATE public.withdrawal_requests SET status='approved',reviewer_id=auth.uid(),processed_at=now() WHERE id=r.id;
  INSERT INTO public.notifications(user_id,type,title,body,link)
    VALUES (r.user_id,'withdrawal_approved','Withdrawal approved',
      'Payment of $'||to_char(r.net_cents/100.0,'FM999999999.00')||' will arrive via PayPal within 48 hours.','/withdrawals');
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'approve_withdrawal','withdrawal_requests',r.id,jsonb_build_object('amount_cents',r.amount_cents,'fee_cents',r.fee_cents));
END; $$;

CREATE OR REPLACE FUNCTION public.reject_withdrawal(_id uuid, _reason text, _suspend_withdrawals boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r RECORD; w RECORD;
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_staff_permission(auth.uid(),'approve_withdrawals')) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.withdrawal_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND OR r.status<>'pending' THEN RAISE EXCEPTION 'Withdrawal not pending'; END IF;
  SELECT * INTO w FROM public.wallets WHERE user_id=r.user_id FOR UPDATE;
  -- Release reserve back to available
  UPDATE public.wallets SET pending_withdrawal_cents = GREATEST(0, pending_withdrawal_cents - r.amount_cents),
                             available_cents = available_cents + LEAST(pending_withdrawal_cents, r.amount_cents)
    WHERE id = w.id;
  UPDATE public.withdrawal_requests SET status='rejected',reviewer_id=auth.uid(),rejection_reason=_reason,processed_at=now() WHERE id=r.id;
  IF _suspend_withdrawals THEN
    UPDATE public.profiles SET withdrawal_hold=true WHERE id=r.user_id;
    INSERT INTO public.notifications(user_id,type,title,body,link)
      VALUES (r.user_id,'withdrawal_hold_enabled','Withdrawals on hold','Your withdrawals have been paused. You can continue earning; contact support for details.','/support');
  END IF;
  INSERT INTO public.notifications(user_id,type,title,body,link)
    VALUES (r.user_id,'withdrawal_rejected','Withdrawal rejected',COALESCE(_reason,'Withdrawal rejected.'),'/withdrawals');
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'reject_withdrawal','withdrawal_requests',r.id,jsonb_build_object('reason',_reason,'suspend',_suspend_withdrawals));
END; $$;

-- 7. Block submissions/applications when suspended
CREATE OR REPLACE FUNCTION public.apply_to_task(_task_id uuid, _note text DEFAULT NULL::text, _cover_letter text DEFAULT NULL::text, _experience text DEFAULT NULL::text, _cv_path text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE t RECORD; existing RECORD; app_count integer; new_id uuid; p RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT suspended INTO p FROM public.profiles WHERE id=auth.uid();
  IF p.suspended THEN RAISE EXCEPTION 'Account is suspended'; END IF;
  SELECT * INTO t FROM public.tasks WHERE id=_task_id AND status='published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not available'; END IF;
  IF t.ends_at IS NOT NULL AND now()>t.ends_at THEN RAISE EXCEPTION 'Task ended'; END IF;
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

-- 8. approve_submission: add reward_credited notification
CREATE OR REPLACE FUNCTION public.approve_submission(_submission_id uuid, _notes text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE s RECORD; t RECORD; w RECORD; new_bal integer;
BEGIN
  IF NOT public.has_staff_permission(auth.uid(),'review_submissions') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO s FROM public.task_submissions WHERE id=_submission_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
  IF s.status NOT IN ('pending','resubmit') THEN RAISE EXCEPTION 'Only pending submissions can be approved'; END IF;
  SELECT * INTO t FROM public.tasks WHERE id=s.task_id;
  SELECT * INTO w FROM public.wallets WHERE user_id=s.user_id FOR UPDATE;
  IF NOT FOUND THEN INSERT INTO public.wallets(user_id) VALUES (s.user_id) RETURNING * INTO w; END IF;
  new_bal := w.available_cents + t.reward_cents;
  UPDATE public.wallets SET available_cents=new_bal, lifetime_earned_cents=lifetime_earned_cents+t.reward_cents WHERE id=w.id;
  INSERT INTO public.wallet_transactions(wallet_id,user_id,type,amount_cents,balance_after_cents,reference_type,reference_id,memo)
    VALUES (w.id,s.user_id,'earning',t.reward_cents,new_bal,'task_submission',s.id,'Reward for: '||t.title);
  UPDATE public.task_submissions SET status='approved',reviewer_id=auth.uid(),review_notes=_notes,reviewed_at=now() WHERE id=s.id;
  INSERT INTO public.notifications(user_id,type,title,body,link)
    VALUES (s.user_id,'task_approved','Task approved','Your submission for "'||t.title||'" was approved.','/submissions'),
           (s.user_id,'reward_credited','Reward credited','$'||to_char(t.reward_cents/100.0,'FM999999999.00')||' added to your wallet.','/wallet');
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'approve_submission','task_submissions',s.id,jsonb_build_object('reward_cents',t.reward_cents));
END; $$;

-- 9. Admin management RPCs
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid, email text, full_name text, avatar_url text, created_at timestamptz, last_sign_in_at timestamptz,
  suspended boolean, withdrawal_hold boolean,
  available_cents integer, pending_withdrawal_cents integer, lifetime_earned_cents integer, lifetime_withdrawn_cents integer,
  roles text[], applications_count bigint, approved_tasks bigint, pending_tasks bigint, withdrawals_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.id,
    u.email::text,
    p.full_name,
    p.avatar_url,
    p.created_at,
    u.last_sign_in_at,
    p.suspended,
    p.withdrawal_hold,
    COALESCE(w.available_cents,0),
    COALESCE(w.pending_withdrawal_cents,0),
    COALESCE(w.lifetime_earned_cents,0),
    COALESCE(w.lifetime_withdrawn_cents,0),
    COALESCE((SELECT array_agg(role::text) FROM public.user_roles WHERE user_id=p.id), ARRAY[]::text[]),
    (SELECT count(*) FROM public.task_applications WHERE user_id=p.id),
    (SELECT count(*) FROM public.task_submissions WHERE user_id=p.id AND status='approved'),
    (SELECT count(*) FROM public.task_submissions WHERE user_id=p.id AND status='pending'),
    (SELECT count(*) FROM public.withdrawal_requests WHERE user_id=p.id)
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id=p.id
  LEFT JOIN public.wallets w ON w.user_id=p.id
  WHERE public.is_super_admin(auth.uid())
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_suspended(_user_id uuid, _suspended boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  UPDATE public.profiles SET suspended=_suspended WHERE id=_user_id;
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(), CASE WHEN _suspended THEN 'suspend_user' ELSE 'unsuspend_user' END,'profiles',_user_id,'{}'::jsonb);
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_suspended(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_suspended(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_withdrawal_hold(_user_id uuid, _hold boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_staff_permission(auth.uid(),'approve_withdrawals')) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  UPDATE public.profiles SET withdrawal_hold=_hold WHERE id=_user_id;
  INSERT INTO public.notifications(user_id,type,title,body,link)
    VALUES (_user_id,
      CASE WHEN _hold THEN 'withdrawal_hold_enabled'::public.notification_type ELSE 'withdrawal_hold_removed'::public.notification_type END,
      CASE WHEN _hold THEN 'Withdrawals on hold' ELSE 'Withdrawals re-enabled' END,
      CASE WHEN _hold THEN 'Withdrawals paused by an administrator.' ELSE 'You can now request withdrawals again.' END,
      '/withdrawals');
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(), CASE WHEN _hold THEN 'hold_withdrawals' ELSE 'release_withdrawals' END,'profiles',_user_id,'{}'::jsonb);
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_withdrawal_hold(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_withdrawal_hold(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_promote_staff(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (_user_id, 'staff') ON CONFLICT DO NOTHING;
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'promote_staff','user_roles',_user_id,'{}'::jsonb);
END; $$;
REVOKE ALL ON FUNCTION public.admin_promote_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_promote_staff(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_remove_staff(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  DELETE FROM public.user_roles WHERE user_id=_user_id AND role IN ('staff');
  DELETE FROM public.staff_permissions WHERE user_id=_user_id;
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'remove_staff','user_roles',_user_id,'{}'::jsonb);
END; $$;
REVOKE ALL ON FUNCTION public.admin_remove_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_staff(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_staff()
RETURNS TABLE (
  id uuid, email text, full_name text, avatar_url text, created_at timestamptz, last_sign_in_at timestamptz,
  is_super_admin boolean, permissions text[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT
    p.id, u.email::text, p.full_name, p.avatar_url, p.created_at, u.last_sign_in_at,
    EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p.id AND role IN ('super_admin','admin')) AS is_super_admin,
    COALESCE((SELECT array_agg(permission::text) FROM public.staff_permissions WHERE user_id=p.id), ARRAY[]::text[])
  FROM public.profiles p
  JOIN auth.users u ON u.id=p.id
  WHERE public.is_super_admin(auth.uid())
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=p.id AND role IN ('staff','super_admin','admin'))
  ORDER BY p.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.admin_list_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_staff() TO authenticated;

-- 10. Grant execute on request_withdrawal/approve/reject to authenticated (restrict others)
REVOKE ALL ON FUNCTION public.request_withdrawal(integer,withdrawal_method,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(integer,withdrawal_method,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.approve_withdrawal(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.reject_withdrawal(uuid,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal(uuid,text,boolean) TO authenticated;
