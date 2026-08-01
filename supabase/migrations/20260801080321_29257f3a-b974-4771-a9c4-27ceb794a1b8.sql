-- ============ PART 1: KYC ============
CREATE TABLE IF NOT EXISTS public.kyc_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  id_front_path text NOT NULL,
  id_back_path text NOT NULL,
  selfie_path text NOT NULL,
  paypal_email text NOT NULL,
  phone text NOT NULL,
  admin_notes text,
  rejection_reason text,
  reviewer_id uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.kyc_verifications TO authenticated;
GRANT ALL ON public.kyc_verifications TO service_role;
ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kyc own select" ON public.kyc_verifications;
CREATE POLICY "kyc own select" ON public.kyc_verifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()) OR public.has_staff_permission(auth.uid(),'approve_withdrawals'));

DROP POLICY IF EXISTS "kyc own insert" ON public.kyc_verifications;
CREATE POLICY "kyc own insert" ON public.kyc_verifications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE UNIQUE INDEX IF NOT EXISTS kyc_one_open_per_user
  ON public.kyc_verifications(user_id) WHERE status IN ('pending','approved');

DROP TRIGGER IF EXISTS kyc_updated_at ON public.kyc_verifications;
CREATE TRIGGER kyc_updated_at BEFORE UPDATE ON public.kyc_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies (private bucket kyc-documents)
DROP POLICY IF EXISTS "kyc upload own" ON storage.objects;
CREATE POLICY "kyc upload own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "kyc read own or reviewer" ON storage.objects;
CREATE POLICY "kyc read own or reviewer" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_super_admin(auth.uid())
    OR public.has_staff_permission(auth.uid(),'approve_withdrawals')
  ));

CREATE OR REPLACE FUNCTION public.get_my_kyc()
RETURNS TABLE(id uuid, status text, paypal_email text, phone text, rejection_reason text,
              created_at timestamptz, reviewed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT k.id,k.status,k.paypal_email,k.phone,k.rejection_reason,k.created_at,k.reviewed_at
  FROM public.kyc_verifications k
  WHERE k.user_id = auth.uid()
  ORDER BY k.created_at DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.submit_kyc(_id_front text, _id_back text, _selfie text, _paypal_email text, _phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
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
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_kyc()
RETURNS TABLE(id uuid, user_id uuid, full_name text, email text, phone text, paypal_email text,
              status text, created_at timestamptz, reviewed_at timestamptz,
              withdrawal_hold boolean, suspended boolean, pending_withdrawals bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT k.id,k.user_id,p.full_name,u.email::text,k.phone,k.paypal_email,k.status,k.created_at,k.reviewed_at,
    p.withdrawal_hold,p.suspended,
    (SELECT count(*) FROM public.withdrawal_requests w WHERE w.user_id=k.user_id AND w.status='pending')
  FROM public.kyc_verifications k
  LEFT JOIN public.profiles p ON p.id=k.user_id
  LEFT JOIN auth.users u ON u.id=k.user_id
  WHERE public.is_super_admin(auth.uid()) OR public.has_staff_permission(auth.uid(),'approve_withdrawals')
  ORDER BY (k.status='pending') DESC, k.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_kyc_detail(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE k RECORD; res jsonb;
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_staff_permission(auth.uid(),'approve_withdrawals')) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO k FROM public.kyc_verifications WHERE id=_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  SELECT jsonb_build_object(
    'id',k.id,'user_id',k.user_id,'status',k.status,
    'id_front_path',k.id_front_path,'id_back_path',k.id_back_path,'selfie_path',k.selfie_path,
    'paypal_email',k.paypal_email,'phone',k.phone,'admin_notes',k.admin_notes,
    'rejection_reason',k.rejection_reason,'created_at',k.created_at,'reviewed_at',k.reviewed_at,
    'reviewer_id',k.reviewer_id,
    'user', (SELECT jsonb_build_object('full_name',p.full_name,'email',u.email::text,'joined_at',p.created_at,
              'suspended',p.suspended,'withdrawal_hold',p.withdrawal_hold,
              'available_cents',COALESCE(w.available_cents,0),
              'pending_withdrawal_cents',COALESCE(w.pending_withdrawal_cents,0),
              'lifetime_earned_cents',COALESCE(w.lifetime_earned_cents,0),
              'lifetime_withdrawn_cents',COALESCE(w.lifetime_withdrawn_cents,0),
              'approved_tasks',(SELECT count(*) FROM public.task_submissions ts WHERE ts.user_id=k.user_id AND ts.status='approved'))
            FROM public.profiles p LEFT JOIN auth.users u ON u.id=p.id LEFT JOIN public.wallets w ON w.user_id=p.id
            WHERE p.id=k.user_id),
    'withdrawals', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',r.id,'amount_cents',r.amount_cents,'net_cents',r.net_cents,'status',r.status,'created_at',r.created_at) ORDER BY r.created_at DESC)
            FROM public.withdrawal_requests r WHERE r.user_id=k.user_id),'[]'::jsonb),
    'activity', COALESCE((SELECT jsonb_agg(x) FROM (SELECT jsonb_build_object('action',a.action,'created_at',a.created_at) AS x
            FROM public.audit_logs a WHERE a.actor_id=k.user_id ORDER BY a.created_at DESC LIMIT 10) s),'[]'::jsonb),
    'referral', (SELECT jsonb_build_object('code',ru.code,'applied_at',ru.applied_at,'bonus_awarded_at',ru.bonus_awarded_at)
            FROM public.referral_uses ru WHERE ru.referred_user_id=k.user_id)
  ) INTO res;
  RETURN res;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_approve_kyc(_id uuid, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE k RECORD;
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
END; $$;

CREATE OR REPLACE FUNCTION public.admin_reject_kyc(_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE k RECORD;
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_staff_permission(auth.uid(),'approve_withdrawals')) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF coalesce(trim(_reason),'')='' THEN RAISE EXCEPTION 'Rejection reason required'; END IF;
  SELECT * INTO k FROM public.kyc_verifications WHERE id=_id FOR UPDATE;
  IF NOT FOUND OR k.status<>'pending' THEN RAISE EXCEPTION 'Verification not pending'; END IF;
  UPDATE public.kyc_verifications SET status='rejected',reviewer_id=auth.uid(),reviewed_at=now(),rejection_reason=_reason WHERE id=_id;
  INSERT INTO public.notifications(user_id,type,title,body,link)
    VALUES (k.user_id,'system','Identity verification rejected',_reason||' — you can submit new documents.','/verification');
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'kyc_rejected','kyc_verifications',_id,jsonb_build_object('user_id',k.user_id,'reason',_reason));
END; $$;

REVOKE ALL ON FUNCTION public.submit_kyc(text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_kyc() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_kyc() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_kyc_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_approve_kyc(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reject_kyc(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_kyc(text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_kyc() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_kyc() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_kyc_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_kyc(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_kyc(uuid,text) TO authenticated;

-- ============ PART 2: REFERRAL UPGRADES ============
ALTER TABLE public.referral_codes
  ADD COLUMN IF NOT EXISTS campaign_name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS welcome_bonus_cents integer,
  ADD COLUMN IF NOT EXISTS commission_bps integer,
  ADD COLUMN IF NOT EXISTS min_withdrawal_cents integer,
  ADD COLUMN IF NOT EXISTS commission_duration_days integer,
  ADD COLUMN IF NOT EXISTS leaderboard_eligible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.referral_uses
  ADD COLUMN IF NOT EXISTS commission_expires_at timestamptz;

CREATE TABLE IF NOT EXISTS public.referral_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  prize text NOT NULL,
  winner_count integer NOT NULL DEFAULT 1,
  eligibility text NOT NULL DEFAULT 'all',
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_campaigns TO anon;
GRANT SELECT ON public.referral_campaigns TO authenticated;
GRANT ALL ON public.referral_campaigns TO service_role;
ALTER TABLE public.referral_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "campaigns public read" ON public.referral_campaigns;
CREATE POLICY "campaigns public read" ON public.referral_campaigns FOR SELECT USING (status = 'active' OR public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "campaigns admin manage" ON public.referral_campaigns;
CREATE POLICY "campaigns admin manage" ON public.referral_campaigns FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
GRANT INSERT, UPDATE, DELETE ON public.referral_campaigns TO authenticated;
DROP TRIGGER IF EXISTS campaigns_updated_at ON public.referral_campaigns;
CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON public.referral_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- admin create/update with full config
DROP FUNCTION IF EXISTS public.admin_create_referral_code(uuid,text,integer);
CREATE FUNCTION public.admin_create_referral_code(
  _owner_user_id uuid, _code text, _max_uses integer,
  _campaign_name text DEFAULT NULL, _description text DEFAULT NULL, _expires_at timestamptz DEFAULT NULL,
  _welcome_bonus_cents integer DEFAULT NULL, _commission_bps integer DEFAULT NULL,
  _min_withdrawal_cents integer DEFAULT NULL, _commission_duration_days integer DEFAULT NULL,
  _leaderboard_eligible boolean DEFAULT true, _notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE new_id uuid; s RECORD; norm_code text;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO s FROM public.application_settings WHERE singleton=true;
  norm_code := upper(trim(_code));
  IF norm_code = '' OR norm_code IS NULL THEN RAISE EXCEPTION 'Code required'; END IF;
  IF length(norm_code) < 3 THEN RAISE EXCEPTION 'Code too short'; END IF;
  IF norm_code !~ ('^[' || regexp_replace(s.referral_allowed_chars,'([\\\]\-\^])','\\\1','g') || ']+$') THEN
    RAISE EXCEPTION 'Code contains disallowed characters';
  END IF;
  INSERT INTO public.referral_codes(code, owner_user_id, max_uses, created_by, campaign_name, description,
      expires_at, welcome_bonus_cents, commission_bps, min_withdrawal_cents, commission_duration_days,
      leaderboard_eligible, notes)
    VALUES (norm_code, _owner_user_id, _max_uses, auth.uid(), _campaign_name, _description, _expires_at,
      _welcome_bonus_cents, _commission_bps, _min_withdrawal_cents, _commission_duration_days,
      COALESCE(_leaderboard_eligible,true), _notes)
    RETURNING id INTO new_id;
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'referral_created','referral_codes',new_id,jsonb_build_object('code',norm_code,'owner',_owner_user_id));
  RETURN new_id;
END; $$;

DROP FUNCTION IF EXISTS public.admin_update_referral_code(uuid,text,integer);
CREATE FUNCTION public.admin_update_referral_code(
  _id uuid, _code text, _max_uses integer,
  _campaign_name text DEFAULT NULL, _description text DEFAULT NULL, _expires_at timestamptz DEFAULT NULL,
  _welcome_bonus_cents integer DEFAULT NULL, _commission_bps integer DEFAULT NULL,
  _min_withdrawal_cents integer DEFAULT NULL, _commission_duration_days integer DEFAULT NULL,
  _leaderboard_eligible boolean DEFAULT true, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE norm_code text;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  norm_code := upper(trim(_code));
  UPDATE public.referral_codes SET code=norm_code, max_uses=_max_uses, campaign_name=_campaign_name,
    description=_description, expires_at=_expires_at, welcome_bonus_cents=_welcome_bonus_cents,
    commission_bps=_commission_bps, min_withdrawal_cents=_min_withdrawal_cents,
    commission_duration_days=_commission_duration_days, leaderboard_eligible=COALESCE(_leaderboard_eligible,true),
    notes=_notes
    WHERE id=_id;
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'referral_updated','referral_codes',_id,jsonb_build_object('code',norm_code,'max_uses',_max_uses));
END; $$;

DROP FUNCTION IF EXISTS public.admin_list_referral_codes();
CREATE FUNCTION public.admin_list_referral_codes()
RETURNS TABLE(id uuid, code text, owner_user_id uuid, owner_full_name text, owner_email text, status text,
  max_uses integer, total_uses integer, created_at timestamptz, users_referred bigint,
  pending_bonus_users bigint, awarded_bonus_users bigint, total_bonus_cents bigint, total_commission_cents bigint,
  campaign_name text, description text, expires_at timestamptz, welcome_bonus_cents integer,
  commission_bps integer, min_withdrawal_cents integer, commission_duration_days integer,
  leaderboard_eligible boolean, notes text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT c.id, c.code, c.owner_user_id, p.full_name, u.email::text,
    c.status, c.max_uses, c.total_uses, c.created_at,
    (SELECT count(*) FROM public.referral_uses ru WHERE ru.code_id=c.id),
    (SELECT count(*) FROM public.referral_uses ru WHERE ru.code_id=c.id AND ru.bonus_awarded_at IS NULL),
    (SELECT count(*) FROM public.referral_uses ru WHERE ru.code_id=c.id AND ru.bonus_awarded_at IS NOT NULL),
    COALESCE((SELECT sum(bonus_amount_cents) FROM public.referral_uses ru WHERE ru.code_id=c.id),0),
    COALESCE((SELECT sum(total_commission_cents) FROM public.referral_uses ru WHERE ru.code_id=c.id),0),
    c.campaign_name, c.description, c.expires_at, c.welcome_bonus_cents, c.commission_bps,
    c.min_withdrawal_cents, c.commission_duration_days, c.leaderboard_eligible, c.notes
  FROM public.referral_codes c
  LEFT JOIN public.profiles p ON p.id=c.owner_user_id
  LEFT JOIN auth.users u ON u.id=c.owner_user_id
  WHERE public.is_super_admin(auth.uid())
  ORDER BY c.created_at DESC;
$$;

-- apply code: expiry + commission window
CREATE OR REPLACE FUNCTION public.apply_referral_code(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s RECORD; c RECORD; use_id uuid; norm text; dur integer; expires timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO s FROM public.application_settings WHERE singleton=true;
  IF NOT s.referral_enabled THEN RAISE EXCEPTION 'Referral system is disabled'; END IF;
  IF EXISTS (SELECT 1 FROM public.referral_uses WHERE referred_user_id=auth.uid()) THEN
    RAISE EXCEPTION 'You have already applied a referral code';
  END IF;
  norm := upper(trim(_code));
  SELECT * INTO c FROM public.referral_codes WHERE code=norm FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid referral code'; END IF;
  IF c.status <> 'active' THEN RAISE EXCEPTION 'This referral code is disabled'; END IF;
  IF c.expires_at IS NOT NULL AND now() > c.expires_at THEN RAISE EXCEPTION 'This referral code has expired'; END IF;
  IF c.owner_user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot use your own code'; END IF;
  IF c.max_uses IS NOT NULL AND c.total_uses >= c.max_uses THEN RAISE EXCEPTION 'This referral code has no uses remaining'; END IF;
  dur := c.commission_duration_days;
  expires := CASE WHEN dur IS NULL OR dur <= 0 THEN NULL ELSE now() + (dur || ' days')::interval END;
  INSERT INTO public.referral_uses(code_id,code,owner_user_id,referred_user_id,commission_expires_at)
    VALUES (c.id,c.code,c.owner_user_id,auth.uid(),expires) RETURNING id INTO use_id;
  UPDATE public.referral_codes SET total_uses=total_uses+1 WHERE id=c.id;
  INSERT INTO public.notifications(user_id,type,title,body,link) VALUES
    (auth.uid(),'referral_applied','Referral code accepted','You applied code '||c.code||'. Your welcome bonus will be credited after your first approved task.','/wallet'),
    (auth.uid(),'referral_bonus_pending','Welcome bonus pending','Complete your first approved task to receive your welcome bonus.','/tasks'),
    (c.owner_user_id,'referral_applied','New referral','Someone applied your referral code '||c.code||'.','/referrals');
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'referral_applied','referral_uses',use_id,jsonb_build_object('code',c.code));
  RETURN use_id;
END; $$;

-- per-code welcome bonus
CREATE OR REPLACE FUNCTION public.approve_submission(_submission_id uuid, _notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s RECORD; t RECORD; w RECORD; new_bal integer;
        ru RECORD; ss RECORD; rc RECORD; bonus integer; approved_count integer;
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

  SELECT * INTO ru FROM public.referral_uses WHERE referred_user_id=s.user_id FOR UPDATE;
  IF FOUND AND ru.bonus_awarded_at IS NULL THEN
    SELECT count(*) INTO approved_count FROM public.task_submissions WHERE user_id=s.user_id AND status='approved';
    IF approved_count >= 1 THEN
      SELECT * INTO ss FROM public.application_settings WHERE singleton=true;
      SELECT * INTO rc FROM public.referral_codes WHERE id=ru.code_id;
      bonus := COALESCE(rc.welcome_bonus_cents, ss.referral_welcome_bonus_cents);
      IF ss.referral_enabled AND bonus > 0 THEN
        new_bal := new_bal + bonus;
        UPDATE public.wallets SET available_cents=new_bal, lifetime_earned_cents=lifetime_earned_cents+bonus WHERE id=w.id;
        INSERT INTO public.wallet_transactions(wallet_id,user_id,type,amount_cents,balance_after_cents,reference_type,reference_id,memo)
          VALUES (w.id,s.user_id,'referral_bonus',bonus,new_bal,'referral_uses',ru.id,'Referral welcome bonus');
        UPDATE public.referral_uses SET bonus_awarded_at=now(), bonus_amount_cents=bonus WHERE id=ru.id;
        INSERT INTO public.notifications(user_id,type,title,body,link)
          VALUES (s.user_id,'referral_bonus_awarded','Welcome bonus credited','$'||to_char(bonus/100.0,'FM999999999.00')||' welcome bonus added to your wallet.','/wallet');
        INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
          VALUES (auth.uid(),'referral_bonus_awarded','referral_uses',ru.id,jsonb_build_object('user_id',s.user_id,'amount_cents',bonus));
      END IF;
    END IF;
  END IF;
END; $$;

-- withdrawal approval: KYC gate + per-code commission
CREATE OR REPLACE FUNCTION public.approve_withdrawal(_id uuid, _notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r RECORD; w RECORD; new_bal integer;
        ru RECORD; ss RECORD; rc RECORD; owner_wallet RECORD; commission integer; ow_bal integer;
        eff_bps integer; eff_min integer;
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_staff_permission(auth.uid(),'approve_withdrawals')) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.withdrawal_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND OR r.status<>'pending' THEN RAISE EXCEPTION 'Withdrawal not pending'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kyc_verifications k WHERE k.user_id=r.user_id AND k.status='approved') THEN
    RAISE EXCEPTION 'User has not completed identity verification';
  END IF;
  SELECT * INTO w FROM public.wallets WHERE user_id=r.user_id FOR UPDATE;
  IF w.pending_withdrawal_cents < r.amount_cents THEN RAISE EXCEPTION 'Reserve mismatch'; END IF;
  UPDATE public.wallets SET pending_withdrawal_cents = pending_withdrawal_cents - r.amount_cents,
                             lifetime_withdrawn_cents = lifetime_withdrawn_cents + r.amount_cents
    WHERE id = w.id RETURNING available_cents INTO new_bal;
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

  SELECT * INTO ru FROM public.referral_uses WHERE referred_user_id=r.user_id FOR UPDATE;
  IF FOUND AND (ru.commission_expires_at IS NULL OR now() <= ru.commission_expires_at) THEN
    SELECT * INTO ss FROM public.application_settings WHERE singleton=true;
    SELECT * INTO rc FROM public.referral_codes WHERE id=ru.code_id;
    eff_bps := COALESCE(rc.commission_bps, ss.referral_commission_bps);
    eff_min := COALESCE(rc.min_withdrawal_cents, ss.referral_min_withdrawal_cents);
    IF ss.referral_enabled AND eff_bps > 0 AND r.amount_cents >= eff_min THEN
      commission := (r.amount_cents * eff_bps / 10000)::integer;
      IF commission > 0 THEN
        SELECT * INTO owner_wallet FROM public.wallets WHERE user_id=ru.owner_user_id FOR UPDATE;
        IF NOT FOUND THEN INSERT INTO public.wallets(user_id) VALUES (ru.owner_user_id) RETURNING * INTO owner_wallet; END IF;
        ow_bal := owner_wallet.available_cents + commission;
        UPDATE public.wallets SET available_cents=ow_bal, lifetime_earned_cents=lifetime_earned_cents+commission WHERE id=owner_wallet.id;
        INSERT INTO public.wallet_transactions(wallet_id,user_id,type,amount_cents,balance_after_cents,reference_type,reference_id,memo)
          VALUES (owner_wallet.id,ru.owner_user_id,'referral_commission',commission,ow_bal,'withdrawal_requests',r.id,'Referral commission from a referred user withdrawal');
        UPDATE public.referral_uses SET total_commission_cents=total_commission_cents+commission WHERE id=ru.id;
        INSERT INTO public.notifications(user_id,type,title,body,link)
          VALUES (ru.owner_user_id,'referral_commission_earned','Referral commission credited',
            '$'||to_char(commission/100.0,'FM999999999.00')||' commission added from a referred user withdrawal.','/referrals');
        INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
          VALUES (auth.uid(),'referral_commission','referral_uses',ru.id,
            jsonb_build_object('owner',ru.owner_user_id,'from_user',r.user_id,'amount_cents',commission));
      END IF;
    END IF;
  END IF;
END; $$;

-- my code with extra fields
DROP FUNCTION IF EXISTS public.get_my_referral_code();
CREATE FUNCTION public.get_my_referral_code()
RETURNS TABLE(id uuid, code text, status text, max_uses integer, total_uses integer, users_referred bigint,
  pending_bonus_users bigint, awarded_bonus_users bigint, total_bonus_cents bigint, total_commission_cents bigint,
  total_withdrawn_by_referred_cents bigint, campaign_name text, description text, expires_at timestamptz,
  welcome_bonus_cents integer, commission_bps integer, commission_duration_days integer,
  leaderboard_eligible boolean, next_commission_expiry timestamptz, leaderboard_rank bigint,
  commission_last_30_cents bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT c.id, c.code, c.status, c.max_uses, c.total_uses,
    (SELECT count(*) FROM public.referral_uses ru WHERE ru.code_id=c.id),
    (SELECT count(*) FROM public.referral_uses ru WHERE ru.code_id=c.id AND ru.bonus_awarded_at IS NULL),
    (SELECT count(*) FROM public.referral_uses ru WHERE ru.code_id=c.id AND ru.bonus_awarded_at IS NOT NULL),
    COALESCE((SELECT sum(bonus_amount_cents) FROM public.referral_uses ru WHERE ru.code_id=c.id),0),
    COALESCE((SELECT sum(total_commission_cents) FROM public.referral_uses ru WHERE ru.code_id=c.id),0),
    COALESCE((SELECT sum(w.lifetime_withdrawn_cents) FROM public.referral_uses ru
              JOIN public.wallets w ON w.user_id=ru.referred_user_id WHERE ru.code_id=c.id),0),
    c.campaign_name, c.description, c.expires_at,
    COALESCE(c.welcome_bonus_cents,(SELECT referral_welcome_bonus_cents FROM public.application_settings WHERE singleton=true)),
    COALESCE(c.commission_bps,(SELECT referral_commission_bps FROM public.application_settings WHERE singleton=true)),
    c.commission_duration_days, c.leaderboard_eligible,
    (SELECT min(ru.commission_expires_at) FROM public.referral_uses ru WHERE ru.code_id=c.id AND ru.commission_expires_at > now()),
    (SELECT r.rank FROM public.get_referral_leaderboard(1000) r WHERE r.owner_user_id=c.owner_user_id),
    COALESCE((SELECT sum(wt.amount_cents) FROM public.wallet_transactions wt
              WHERE wt.user_id=c.owner_user_id AND wt.type='referral_commission' AND wt.created_at > now()-interval '30 days'),0)
  FROM public.referral_codes c
  WHERE c.owner_user_id=auth.uid();
$$;

DROP FUNCTION IF EXISTS public.get_referral_leaderboard(integer);
CREATE FUNCTION public.get_referral_leaderboard(_limit integer DEFAULT 20)
RETURNS TABLE(rank bigint, owner_user_id uuid, display_name text, successful_referrals bigint,
  commission_earned_cents bigint, month_referrals bigint, week_referrals bigint, badge text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH ranked AS (
    SELECT c.owner_user_id,
      COALESCE(NULLIF(p.full_name,''), 'Member') AS display_name,
      COUNT(ru.id) FILTER (WHERE ru.bonus_awarded_at IS NOT NULL) AS successful_referrals,
      COALESCE(SUM(ru.total_commission_cents),0)::bigint AS commission_earned_cents,
      COUNT(ru.id) FILTER (WHERE ru.applied_at > date_trunc('month', now())) AS month_referrals,
      COUNT(ru.id) FILTER (WHERE ru.applied_at > now() - interval '7 days') AS week_referrals
    FROM public.referral_codes c
    LEFT JOIN public.referral_uses ru ON ru.code_id = c.id
    LEFT JOIN public.profiles p ON p.id = c.owner_user_id
    WHERE c.status = 'active' AND c.leaderboard_eligible
    GROUP BY c.owner_user_id, p.full_name
  ), r2 AS (
    SELECT ROW_NUMBER() OVER (ORDER BY successful_referrals DESC, commission_earned_cents DESC) AS rank, *
    FROM ranked WHERE successful_referrals > 0
  )
  SELECT rank, owner_user_id, display_name, successful_referrals, commission_earned_cents,
    month_referrals, week_referrals,
    CASE WHEN successful_referrals >= 50 THEN 'Diamond'
         WHEN successful_referrals >= 25 THEN 'Platinum'
         WHEN successful_referrals >= 10 THEN 'Gold'
         WHEN successful_referrals >= 5 THEN 'Silver'
         ELSE 'Bronze' END
  FROM r2 ORDER BY rank LIMIT COALESCE(_limit,20);
$$;
GRANT EXECUTE ON FUNCTION public.get_referral_leaderboard(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_referral_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_referral_codes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_referral_code(uuid,text,integer,text,text,timestamptz,integer,integer,integer,integer,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_referral_code(uuid,text,integer,text,text,timestamptz,integer,integer,integer,integer,boolean,text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_create_referral_code(uuid,text,integer,text,text,timestamptz,integer,integer,integer,integer,boolean,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_referral_code(uuid,text,integer,text,text,timestamptz,integer,integer,integer,integer,boolean,text) FROM PUBLIC, anon;

-- ============ PART 3: ANALYTICS ============
CREATE OR REPLACE FUNCTION public.admin_analytics_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE res jsonb;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object(
    'users', jsonb_build_object(
      'total',(SELECT count(*) FROM public.profiles),
      'today',(SELECT count(*) FROM public.profiles WHERE created_at >= date_trunc('day',now())),
      'week',(SELECT count(*) FROM public.profiles WHERE created_at >= now()-interval '7 days'),
      'month',(SELECT count(*) FROM public.profiles WHERE created_at >= date_trunc('month',now())),
      'active_today',(SELECT count(DISTINCT actor_id) FROM public.audit_logs WHERE created_at >= date_trunc('day',now())),
      'active_week',(SELECT count(DISTINCT actor_id) FROM public.audit_logs WHERE created_at >= now()-interval '7 days'),
      'returning',(SELECT count(*) FROM (SELECT actor_id FROM public.audit_logs WHERE created_at >= now()-interval '30 days' GROUP BY actor_id HAVING count(DISTINCT date_trunc('day',created_at))>1) q),
      'verification_pending',(SELECT count(*) FROM public.kyc_verifications WHERE status='pending'),
      'suspended',(SELECT count(*) FROM public.profiles WHERE suspended)
    ),
    'tasks', jsonb_build_object(
      'created',(SELECT count(*) FROM public.tasks),
      'published',(SELECT count(*) FROM public.tasks WHERE status='published'),
      'completed',(SELECT count(*) FROM public.task_submissions WHERE status='approved'),
      'rejected',(SELECT count(*) FROM public.task_submissions WHERE status='rejected'),
      'pending_applications',(SELECT count(*) FROM public.task_applications WHERE status='pending'),
      'pending_submissions',(SELECT count(*) FROM public.task_submissions WHERE status='pending'),
      'avg_completion_minutes',(SELECT COALESCE(round(avg(EXTRACT(EPOCH FROM (reviewed_at-created_at))/60))::int,0) FROM public.task_submissions WHERE reviewed_at IS NOT NULL)
    ),
    'withdrawals', jsonb_build_object(
      'pending',(SELECT count(*) FROM public.withdrawal_requests WHERE status='pending'),
      'approved',(SELECT count(*) FROM public.withdrawal_requests WHERE status='approved'),
      'rejected',(SELECT count(*) FROM public.withdrawal_requests WHERE status='rejected'),
      'today',(SELECT count(*) FROM public.withdrawal_requests WHERE created_at >= date_trunc('day',now())),
      'month',(SELECT count(*) FROM public.withdrawal_requests WHERE created_at >= date_trunc('month',now())),
      'lifetime_payout_cents',(SELECT COALESCE(sum(net_cents),0) FROM public.withdrawal_requests WHERE status='approved'),
      'fee_revenue_cents',(SELECT COALESCE(sum(fee_cents),0) FROM public.withdrawal_requests WHERE status='approved'),
      'outstanding_cents',(SELECT COALESCE(sum(amount_cents),0) FROM public.withdrawal_requests WHERE status='pending')
    ),
    'finance', jsonb_build_object(
      'revenue_today_cents',(SELECT COALESCE(sum(fee_cents),0) FROM public.withdrawal_requests WHERE status='approved' AND processed_at >= date_trunc('day',now())),
      'expenses_today_cents',(SELECT COALESCE(sum(-amount_cents),0) FROM public.wallet_transactions WHERE type IN ('earning','referral_bonus','referral_commission') AND created_at >= date_trunc('day',now()))*-1,
      'lifetime_revenue_cents',(SELECT COALESCE(sum(fee_cents),0) FROM public.withdrawal_requests WHERE status='approved'),
      'lifetime_expenses_cents',(SELECT COALESCE(sum(amount_cents),0) FROM public.wallet_transactions WHERE type IN ('earning','referral_bonus','referral_commission')),
      'wallet_liability_cents',(SELECT COALESCE(sum(available_cents+pending_withdrawal_cents),0) FROM public.wallets),
      'arpu_cents',(SELECT CASE WHEN count(*)=0 THEN 0 ELSE (SELECT COALESCE(sum(fee_cents),0) FROM public.withdrawal_requests WHERE status='approved')/count(*) END FROM public.profiles),
      'avg_payout_cents',(SELECT CASE WHEN count(*)=0 THEN 0 ELSE (SELECT COALESCE(sum(net_cents),0) FROM public.withdrawal_requests WHERE status='approved')/count(*) END FROM public.profiles)
    ),
    'referrals', jsonb_build_object(
      'codes',(SELECT count(*) FROM public.referral_codes),
      'codes_used',(SELECT count(DISTINCT code_id) FROM public.referral_uses),
      'uses',(SELECT count(*) FROM public.referral_uses),
      'converted',(SELECT count(*) FROM public.referral_uses WHERE bonus_awarded_at IS NOT NULL),
      'bonus_paid_cents',(SELECT COALESCE(sum(bonus_amount_cents),0) FROM public.referral_uses),
      'commission_paid_cents',(SELECT COALESCE(sum(total_commission_cents),0) FROM public.referral_uses),
      'active_campaigns',(SELECT count(*) FROM public.referral_campaigns WHERE status='active' AND now() BETWEEN starts_at AND ends_at),
      'growth_30d',(SELECT count(*) FROM public.referral_uses WHERE applied_at >= now()-interval '30 days')
    ),
    'staff', jsonb_build_object(
      'applications_reviewed',(SELECT count(*) FROM public.task_applications WHERE reviewed_at IS NOT NULL),
      'submissions_reviewed',(SELECT count(*) FROM public.task_submissions WHERE reviewed_at IS NOT NULL),
      'withdrawals_approved',(SELECT count(*) FROM public.withdrawal_requests WHERE status='approved'),
      'avg_review_minutes',(SELECT COALESCE(round(avg(EXTRACT(EPOCH FROM (reviewed_at-created_at))/60))::int,0) FROM public.task_submissions WHERE reviewed_at IS NOT NULL),
      'tickets_resolved',(SELECT count(*) FROM public.support_tickets WHERE status IN ('resolved','closed')),
      'announcements',(SELECT count(*) FROM public.announcements WHERE published_at IS NOT NULL)
    ),
    'security', jsonb_build_object(
      'suspended',(SELECT count(*) FROM public.profiles WHERE suspended),
      'kyc_pending',(SELECT count(*) FROM public.kyc_verifications WHERE status='pending'),
      'withdrawal_holds',(SELECT count(*) FROM public.profiles WHERE withdrawal_hold),
      'open_reports',(SELECT count(*) FROM public.reports WHERE status IN ('open','investigating'))
    ),
    'today', jsonb_build_object(
      'new_users',(SELECT count(*) FROM public.profiles WHERE created_at >= date_trunc('day',now())),
      'completed_tasks',(SELECT count(*) FROM public.task_submissions WHERE status='approved' AND reviewed_at >= date_trunc('day',now())),
      'withdrawals_cents',(SELECT COALESCE(sum(amount_cents),0) FROM public.withdrawal_requests WHERE created_at >= date_trunc('day',now())),
      'referral_bonus_cents',(SELECT COALESCE(sum(amount_cents),0) FROM public.wallet_transactions WHERE type='referral_bonus' AND created_at >= date_trunc('day',now())),
      'commission_cents',(SELECT COALESCE(sum(amount_cents),0) FROM public.wallet_transactions WHERE type='referral_commission' AND created_at >= date_trunc('day',now())),
      'expenses_cents',(SELECT COALESCE(sum(amount_cents),0) FROM public.wallet_transactions WHERE type IN ('earning','referral_bonus','referral_commission') AND created_at >= date_trunc('day',now()))
    ),
    'recent_security_events', COALESCE((SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('action',a.action,'created_at',a.created_at,'target_type',a.target_type) AS x
        FROM public.audit_logs a
        WHERE a.action IN ('suspend_user','unsuspend_user','hold_withdrawals','release_withdrawals','kyc_rejected','kyc_approved','reject_withdrawal')
        ORDER BY a.created_at DESC LIMIT 10) s),'[]'::jsonb),
    'top_referrers', COALESCE((SELECT jsonb_agg(jsonb_build_object('name',l.display_name,'referrals',l.successful_referrals,'commission_cents',l.commission_earned_cents))
        FROM public.get_referral_leaderboard(5) l),'[]'::jsonb)
  ) INTO res;
  RETURN res;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_analytics_series(_days integer DEFAULT 30)
RETURNS TABLE(day date, signups bigint, tasks_completed bigint, referrals bigint,
  revenue_cents bigint, expenses_cents bigint, profit_cents bigint,
  withdrawals bigint, payout_cents bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH d AS (
    SELECT generate_series(date_trunc('day',now())-((COALESCE(_days,30)-1)||' days')::interval, date_trunc('day',now()), '1 day')::date AS day
  )
  SELECT d.day,
    (SELECT count(*) FROM public.profiles p WHERE p.created_at::date=d.day),
    (SELECT count(*) FROM public.task_submissions t WHERE t.status='approved' AND t.reviewed_at::date=d.day),
    (SELECT count(*) FROM public.referral_uses ru WHERE ru.applied_at::date=d.day),
    (SELECT COALESCE(sum(w.fee_cents),0) FROM public.withdrawal_requests w WHERE w.status='approved' AND w.processed_at::date=d.day),
    (SELECT COALESCE(sum(wt.amount_cents),0) FROM public.wallet_transactions wt WHERE wt.type IN ('earning','referral_bonus','referral_commission') AND wt.created_at::date=d.day),
    (SELECT COALESCE(sum(w.fee_cents),0) FROM public.withdrawal_requests w WHERE w.status='approved' AND w.processed_at::date=d.day)
      - (SELECT COALESCE(sum(wt.amount_cents),0) FROM public.wallet_transactions wt WHERE wt.type IN ('earning','referral_bonus','referral_commission') AND wt.created_at::date=d.day),
    (SELECT count(*) FROM public.withdrawal_requests w WHERE w.created_at::date=d.day),
    (SELECT COALESCE(sum(w.net_cents),0) FROM public.withdrawal_requests w WHERE w.status='approved' AND w.processed_at::date=d.day)
  FROM d ORDER BY d.day;
$$;

REVOKE ALL ON FUNCTION public.admin_analytics_overview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_series(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_analytics_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_series(integer) TO authenticated;