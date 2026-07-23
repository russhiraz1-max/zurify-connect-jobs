
-- ============ ENUM EXTENSIONS ============
ALTER TYPE public.tx_type ADD VALUE IF NOT EXISTS 'referral_bonus';
ALTER TYPE public.tx_type ADD VALUE IF NOT EXISTS 'referral_commission';
ALTER TYPE public.tx_type ADD VALUE IF NOT EXISTS 'manual_credit';
ALTER TYPE public.tx_type ADD VALUE IF NOT EXISTS 'manual_debit';

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'referral_applied';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'referral_bonus_pending';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'referral_bonus_awarded';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'referral_commission_earned';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'referral_disabled';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'referral_enabled';

-- ============ SETTINGS COLUMNS ============
ALTER TABLE public.application_settings
  ADD COLUMN IF NOT EXISTS referral_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS referral_welcome_bonus_cents integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS referral_commission_bps integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS referral_min_withdrawal_cents integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS referral_code_length integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS referral_allowed_chars text NOT NULL DEFAULT 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  ADD COLUMN IF NOT EXISTS referral_default_max_uses integer,
  ADD COLUMN IF NOT EXISTS referral_unlimited_uses boolean NOT NULL DEFAULT true;

-- ============ REFERRAL CODES ============
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  max_uses integer,
  total_uses integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id)
);
CREATE INDEX IF NOT EXISTS referral_codes_owner_idx ON public.referral_codes(owner_user_id);
CREATE INDEX IF NOT EXISTS referral_codes_code_idx ON public.referral_codes(code);

GRANT SELECT ON public.referral_codes TO authenticated;
GRANT ALL ON public.referral_codes TO service_role;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner reads own code" ON public.referral_codes;
CREATE POLICY "owner reads own code" ON public.referral_codes FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_super_admin(auth.uid()));

DROP TRIGGER IF EXISTS referral_codes_updated ON public.referral_codes;
CREATE TRIGGER referral_codes_updated BEFORE UPDATE ON public.referral_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ REFERRAL USES ============
CREATE TABLE IF NOT EXISTS public.referral_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.referral_codes(id) ON DELETE CASCADE,
  code text NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  applied_at timestamptz NOT NULL DEFAULT now(),
  bonus_awarded_at timestamptz,
  bonus_amount_cents integer NOT NULL DEFAULT 0,
  total_commission_cents integer NOT NULL DEFAULT 0,
  CHECK (owner_user_id <> referred_user_id)
);
CREATE INDEX IF NOT EXISTS referral_uses_owner_idx ON public.referral_uses(owner_user_id);
CREATE INDEX IF NOT EXISTS referral_uses_code_idx ON public.referral_uses(code_id);

GRANT SELECT ON public.referral_uses TO authenticated;
GRANT ALL ON public.referral_uses TO service_role;
ALTER TABLE public.referral_uses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner reads own uses" ON public.referral_uses;
CREATE POLICY "owner reads own uses" ON public.referral_uses FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR referred_user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- ============ ADMIN RPCs ============
CREATE OR REPLACE FUNCTION public.admin_create_referral_code(_owner_user_id uuid, _code text, _max_uses integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
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
  INSERT INTO public.referral_codes(code, owner_user_id, max_uses, created_by)
    VALUES (norm_code, _owner_user_id, _max_uses, auth.uid())
    RETURNING id INTO new_id;
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'referral_created','referral_codes',new_id,jsonb_build_object('code',norm_code,'owner',_owner_user_id));
  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_update_referral_code(_id uuid, _code text, _max_uses integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE norm_code text;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  norm_code := upper(trim(_code));
  UPDATE public.referral_codes SET code=norm_code, max_uses=_max_uses WHERE id=_id;
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'referral_updated','referral_codes',_id,jsonb_build_object('code',norm_code,'max_uses',_max_uses));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_assign_referral_code(_id uuid, _new_owner_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE old_owner uuid;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT owner_user_id INTO old_owner FROM public.referral_codes WHERE id=_id;
  IF EXISTS (SELECT 1 FROM public.referral_codes WHERE owner_user_id=_new_owner_user_id AND id<>_id) THEN
    RAISE EXCEPTION 'User already owns a referral code';
  END IF;
  UPDATE public.referral_codes SET owner_user_id=_new_owner_user_id WHERE id=_id;
  UPDATE public.referral_uses SET owner_user_id=_new_owner_user_id WHERE code_id=_id;
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'referral_assigned','referral_codes',_id,jsonb_build_object('from',old_owner,'to',_new_owner_user_id));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_referral_status(_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE owner uuid; code_txt text;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF _status NOT IN ('active','disabled') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  UPDATE public.referral_codes SET status=_status WHERE id=_id RETURNING owner_user_id, code INTO owner, code_txt;
  INSERT INTO public.notifications(user_id,type,title,body,link)
    VALUES (owner, CASE WHEN _status='disabled' THEN 'referral_disabled'::public.notification_type ELSE 'referral_enabled'::public.notification_type END,
      CASE WHEN _status='disabled' THEN 'Referral code disabled' ELSE 'Referral code enabled' END,
      'Your referral code '||code_txt||' is now '||_status||'.', '/referrals');
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'referral_'||_status,'referral_codes',_id,jsonb_build_object('code',code_txt));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_referral_code(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE uses_count integer;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT count(*) INTO uses_count FROM public.referral_uses WHERE code_id=_id;
  IF uses_count > 0 THEN RAISE EXCEPTION 'Cannot delete: code already used %s time(s)', uses_count; END IF;
  DELETE FROM public.referral_codes WHERE id=_id;
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'referral_deleted','referral_codes',_id,'{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_referral_codes()
RETURNS TABLE(id uuid, code text, owner_user_id uuid, owner_full_name text, owner_email text,
  status text, max_uses integer, total_uses integer, created_at timestamptz,
  users_referred bigint, pending_bonus_users bigint, awarded_bonus_users bigint,
  total_bonus_cents bigint, total_commission_cents bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public' AS $$
  SELECT c.id, c.code, c.owner_user_id, p.full_name, u.email::text,
    c.status, c.max_uses, c.total_uses, c.created_at,
    (SELECT count(*) FROM public.referral_uses ru WHERE ru.code_id=c.id),
    (SELECT count(*) FROM public.referral_uses ru WHERE ru.code_id=c.id AND ru.bonus_awarded_at IS NULL),
    (SELECT count(*) FROM public.referral_uses ru WHERE ru.code_id=c.id AND ru.bonus_awarded_at IS NOT NULL),
    COALESCE((SELECT sum(bonus_amount_cents) FROM public.referral_uses ru WHERE ru.code_id=c.id),0),
    COALESCE((SELECT sum(total_commission_cents) FROM public.referral_uses ru WHERE ru.code_id=c.id),0)
  FROM public.referral_codes c
  LEFT JOIN public.profiles p ON p.id=c.owner_user_id
  LEFT JOIN auth.users u ON u.id=c.owner_user_id
  WHERE public.is_super_admin(auth.uid())
  ORDER BY c.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_referral_details(_id uuid)
RETURNS TABLE(referred_user_id uuid, full_name text, email text, applied_at timestamptz,
  bonus_awarded_at timestamptz, bonus_amount_cents integer, total_commission_cents integer,
  wallet_available_cents integer, lifetime_withdrawn_cents integer,
  approved_tasks bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public' AS $$
  SELECT ru.referred_user_id, p.full_name, u.email::text, ru.applied_at,
    ru.bonus_awarded_at, ru.bonus_amount_cents, ru.total_commission_cents,
    COALESCE(w.available_cents,0), COALESCE(w.lifetime_withdrawn_cents,0),
    (SELECT count(*) FROM public.task_submissions ts WHERE ts.user_id=ru.referred_user_id AND ts.status='approved')
  FROM public.referral_uses ru
  LEFT JOIN public.profiles p ON p.id=ru.referred_user_id
  LEFT JOIN auth.users u ON u.id=ru.referred_user_id
  LEFT JOIN public.wallets w ON w.user_id=ru.referred_user_id
  WHERE ru.code_id=_id AND public.is_super_admin(auth.uid())
  ORDER BY ru.applied_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_search_users_for_referral(_q text)
RETURNS TABLE(id uuid, email text, full_name text, has_code boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public' AS $$
  SELECT p.id, u.email::text, p.full_name,
    EXISTS(SELECT 1 FROM public.referral_codes rc WHERE rc.owner_user_id=p.id)
  FROM public.profiles p
  JOIN auth.users u ON u.id=p.id
  WHERE public.is_super_admin(auth.uid())
    AND (_q IS NULL OR _q='' OR u.email ILIKE '%'||_q||'%' OR COALESCE(p.full_name,'') ILIKE '%'||_q||'%')
  ORDER BY p.created_at DESC LIMIT 25;
$$;

-- ============ USER RPCs ============
CREATE OR REPLACE FUNCTION public.apply_referral_code(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE s RECORD; c RECORD; use_id uuid; norm text;
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
  IF c.owner_user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot use your own code'; END IF;
  IF c.max_uses IS NOT NULL AND c.total_uses >= c.max_uses THEN RAISE EXCEPTION 'This referral code has no uses remaining'; END IF;
  INSERT INTO public.referral_uses(code_id,code,owner_user_id,referred_user_id)
    VALUES (c.id,c.code,c.owner_user_id,auth.uid()) RETURNING id INTO use_id;
  UPDATE public.referral_codes SET total_uses=total_uses+1 WHERE id=c.id;
  INSERT INTO public.notifications(user_id,type,title,body,link) VALUES
    (auth.uid(),'referral_applied','Referral code accepted','You applied code '||c.code||'. Your welcome bonus will be credited after your first approved task.','/wallet'),
    (auth.uid(),'referral_bonus_pending','Welcome bonus pending','Complete your first approved task to receive your welcome bonus.','/tasks'),
    (c.owner_user_id,'referral_applied','New referral','Someone applied your referral code '||c.code||'.','/referrals');
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'referral_applied','referral_uses',use_id,jsonb_build_object('code',c.code));
  RETURN use_id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_my_referral_status()
RETURNS TABLE(applied boolean, code text, applied_at timestamptz, bonus_awarded_at timestamptz, bonus_amount_cents integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public' AS $$
  SELECT true, code, applied_at, bonus_awarded_at, bonus_amount_cents
  FROM public.referral_uses WHERE referred_user_id=auth.uid()
  UNION ALL
  SELECT false, NULL::text, NULL::timestamptz, NULL::timestamptz, 0
  WHERE NOT EXISTS (SELECT 1 FROM public.referral_uses WHERE referred_user_id=auth.uid())
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_referral_code()
RETURNS TABLE(id uuid, code text, status text, max_uses integer, total_uses integer,
  users_referred bigint, pending_bonus_users bigint, awarded_bonus_users bigint,
  total_bonus_cents bigint, total_commission_cents bigint,
  total_withdrawn_by_referred_cents bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public' AS $$
  SELECT c.id, c.code, c.status, c.max_uses, c.total_uses,
    (SELECT count(*) FROM public.referral_uses ru WHERE ru.code_id=c.id),
    (SELECT count(*) FROM public.referral_uses ru WHERE ru.code_id=c.id AND ru.bonus_awarded_at IS NULL),
    (SELECT count(*) FROM public.referral_uses ru WHERE ru.code_id=c.id AND ru.bonus_awarded_at IS NOT NULL),
    COALESCE((SELECT sum(bonus_amount_cents) FROM public.referral_uses ru WHERE ru.code_id=c.id),0),
    COALESCE((SELECT sum(total_commission_cents) FROM public.referral_uses ru WHERE ru.code_id=c.id),0),
    COALESCE((SELECT sum(w.lifetime_withdrawn_cents) FROM public.referral_uses ru
              JOIN public.wallets w ON w.user_id=ru.referred_user_id WHERE ru.code_id=c.id),0)
  FROM public.referral_codes c
  WHERE c.owner_user_id=auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_referred_users()
RETURNS TABLE(referred_user_id uuid, full_name text, applied_at timestamptz,
  bonus_awarded_at timestamptz, bonus_amount_cents integer, total_commission_cents integer,
  wallet_available_cents integer, lifetime_withdrawn_cents integer,
  approved_tasks bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public' AS $$
  SELECT ru.referred_user_id, p.full_name, ru.applied_at, ru.bonus_awarded_at,
    ru.bonus_amount_cents, ru.total_commission_cents,
    COALESCE(w.available_cents,0), COALESCE(w.lifetime_withdrawn_cents,0),
    (SELECT count(*) FROM public.task_submissions ts WHERE ts.user_id=ru.referred_user_id AND ts.status='approved')
  FROM public.referral_uses ru
  LEFT JOIN public.profiles p ON p.id=ru.referred_user_id
  LEFT JOIN public.wallets w ON w.user_id=ru.referred_user_id
  WHERE ru.owner_user_id=auth.uid()
  ORDER BY ru.applied_at DESC;
$$;

-- ============ HOOK: welcome bonus + commission ============
-- Rewrite approve_submission to also award welcome bonus on first approved
CREATE OR REPLACE FUNCTION public.approve_submission(_submission_id uuid, _notes text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='public'
AS $function$
DECLARE s RECORD; t RECORD; w RECORD; new_bal integer;
        ru RECORD; ss RECORD; bonus integer; approved_count integer;
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

  -- Referral welcome bonus on first approved submission
  SELECT * INTO ru FROM public.referral_uses WHERE referred_user_id=s.user_id FOR UPDATE;
  IF FOUND AND ru.bonus_awarded_at IS NULL THEN
    SELECT count(*) INTO approved_count FROM public.task_submissions
      WHERE user_id=s.user_id AND status='approved';
    IF approved_count >= 1 THEN
      SELECT * INTO ss FROM public.application_settings WHERE singleton=true;
      bonus := ss.referral_welcome_bonus_cents;
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
END; $function$;

-- Rewrite approve_withdrawal to also credit referral commission
CREATE OR REPLACE FUNCTION public.approve_withdrawal(_id uuid, _notes text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='public'
AS $function$
DECLARE r RECORD; w RECORD; new_bal integer;
        ru RECORD; ss RECORD; owner_wallet RECORD; commission integer; ow_bal integer;
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_staff_permission(auth.uid(),'approve_withdrawals')) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.withdrawal_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND OR r.status<>'pending' THEN RAISE EXCEPTION 'Withdrawal not pending'; END IF;
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

  -- Referral commission
  SELECT * INTO ru FROM public.referral_uses WHERE referred_user_id=r.user_id FOR UPDATE;
  IF FOUND THEN
    SELECT * INTO ss FROM public.application_settings WHERE singleton=true;
    IF ss.referral_enabled AND ss.referral_commission_bps > 0 AND r.amount_cents >= ss.referral_min_withdrawal_cents THEN
      commission := (r.amount_cents * ss.referral_commission_bps / 10000)::integer;
      IF commission > 0 THEN
        SELECT * INTO owner_wallet FROM public.wallets WHERE user_id=ru.owner_user_id FOR UPDATE;
        IF NOT FOUND THEN
          INSERT INTO public.wallets(user_id) VALUES (ru.owner_user_id) RETURNING * INTO owner_wallet;
        END IF;
        ow_bal := owner_wallet.available_cents + commission;
        UPDATE public.wallets SET available_cents=ow_bal, lifetime_earned_cents=lifetime_earned_cents+commission
          WHERE id=owner_wallet.id;
        INSERT INTO public.wallet_transactions(wallet_id,user_id,type,amount_cents,balance_after_cents,reference_type,reference_id,memo)
          VALUES (owner_wallet.id,ru.owner_user_id,'referral_commission',commission,ow_bal,'withdrawal_requests',r.id,
            'Referral commission from '||coalesce((SELECT email::text FROM auth.users WHERE id=r.user_id),'referred user'));
        UPDATE public.referral_uses SET total_commission_cents=total_commission_cents+commission WHERE id=ru.id;
        INSERT INTO public.notifications(user_id,type,title,body,link)
          VALUES (ru.owner_user_id,'referral_commission_earned','Referral commission credited',
            '$'||to_char(commission/100.0,'FM999999999.00')||' commission added from a referred user withdrawal.','/wallet');
        INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
          VALUES (auth.uid(),'referral_commission','referral_uses',ru.id,
            jsonb_build_object('owner',ru.owner_user_id,'from_user',r.user_id,'amount_cents',commission));
      END IF;
    END IF;
  END IF;
END; $function$;

-- ============ GRANT EXECUTE ============
REVOKE ALL ON FUNCTION public.admin_create_referral_code(uuid,text,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_referral_code(uuid,text,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_assign_referral_code(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_referral_status(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_referral_code(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_referral_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_referral_code(uuid,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_referral_code(uuid,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_referral_code(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_referral_status(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_referral_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_referral_codes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_referral_details(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_search_users_for_referral(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_referral_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_referral_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_referred_users() TO authenticated;
