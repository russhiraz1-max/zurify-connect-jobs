-- ============ SETTINGS ============
CREATE TABLE public.engagement_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  streak_enabled boolean NOT NULL DEFAULT true,
  streak_stage1_rewards integer[] NOT NULL DEFAULT ARRAY[2,3,4,5,6,8,10],
  streak_stage2_rewards integer[] NOT NULL DEFAULT ARRAY[12,14,16,18,20,22,25],
  streak_stage2_required_jobs integer NOT NULL DEFAULT 1,
  streak_stage3_rewards integer[] NOT NULL DEFAULT ARRAY[28,30,32,34,36,38,40,42,44,46,48,50,55,60,70,100],
  streak_stage3_required_jobs integer NOT NULL DEFAULT 2,
  streak_max_reward_cents integer NOT NULL DEFAULT 100,
  streak_grace_days integer NOT NULL DEFAULT 0,
  streak_after_30 text NOT NULL DEFAULT 'loop',
  lucky_enabled boolean NOT NULL DEFAULT true,
  lucky_open_time time NOT NULL DEFAULT '12:00',
  lucky_duration_minutes integer NOT NULL DEFAULT 60,
  lucky_reward_cents integer NOT NULL DEFAULT 10,
  lucky_max_winners integer NOT NULL DEFAULT 25,
  lucky_cooldown_days integer NOT NULL DEFAULT 1,
  lucky_require_kyc boolean NOT NULL DEFAULT false,
  lucky_min_approved_jobs integer NOT NULL DEFAULT 0,
  mystery_enabled boolean NOT NULL DEFAULT true,
  mystery_frequency_days integer NOT NULL DEFAULT 7,
  mystery_require_kyc boolean NOT NULL DEFAULT false,
  mystery_min_approved_jobs integer NOT NULL DEFAULT 1,
  mystery_outcomes jsonb NOT NULL DEFAULT '[
    {"label":"Nothing this time","weight":30,"min_cents":0,"max_cents":0},
    {"label":"Small wallet bonus","weight":40,"min_cents":5,"max_cents":15},
    {"label":"Nice wallet bonus","weight":22,"min_cents":16,"max_cents":40},
    {"label":"Big wallet bonus","weight":7,"min_cents":41,"max_cents":100},
    {"label":"Jackpot","weight":1,"min_cents":101,"max_cents":300}
  ]'::jsonb,
  challenges_enabled boolean NOT NULL DEFAULT true,
  challenges_require_kyc boolean NOT NULL DEFAULT false,
  rep_w_approval_rate integer NOT NULL DEFAULT 35,
  rep_w_approved_jobs integer NOT NULL DEFAULT 20,
  rep_w_completed_jobs integer NOT NULL DEFAULT 10,
  rep_w_kyc integer NOT NULL DEFAULT 10,
  rep_w_account_age integer NOT NULL DEFAULT 5,
  rep_w_withdrawals integer NOT NULL DEFAULT 5,
  rep_w_clean_record integer NOT NULL DEFAULT 10,
  rep_w_recent_activity integer NOT NULL DEFAULT 5,
  rep_star_thresholds jsonb NOT NULL DEFAULT '[
    {"stars":2,"min_approved":10,"min_rate":60,"min_score":0,"require_kyc":false,"require_clean":false,"label":"Rising Freelancer"},
    {"stars":3,"min_approved":25,"min_rate":75,"min_score":0,"require_kyc":false,"require_clean":true,"label":"Trusted Freelancer"},
    {"stars":4,"min_approved":50,"min_rate":85,"min_score":0,"require_kyc":false,"require_clean":true,"label":"Professional Freelancer"},
    {"stars":5,"min_approved":100,"min_rate":90,"min_score":0,"require_kyc":true,"require_clean":true,"label":"Elite Freelancer"}
  ]'::jsonb,
  rep_star1_label text NOT NULL DEFAULT 'New Freelancer',
  badges_enabled boolean NOT NULL DEFAULT true,
  pro_enabled boolean NOT NULL DEFAULT false,
  pro_price_cents integer NOT NULL DEFAULT 999,
  pro_duration_days integer NOT NULL DEFAULT 30,
  pro_benefits text[] NOT NULL DEFAULT ARRAY['Priority job visibility','Priority withdrawals','Exclusive jobs','Exclusive Pro badge','Priority support','Featured profile'],
  pro_faq text NOT NULL DEFAULT 'Payment is arranged manually with the Zurify team. Submit a request and an administrator will contact you and activate your membership once payment is confirmed.',
  pro_payment_instructions text NOT NULL DEFAULT 'Send your payment to the PayPal address supplied by support, then submit your request with the transaction reference.',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.engagement_settings TO authenticated, anon;
GRANT ALL ON public.engagement_settings TO service_role;
ALTER TABLE public.engagement_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "engagement settings readable" ON public.engagement_settings FOR SELECT USING (true);
CREATE POLICY "super admin updates engagement settings" ON public.engagement_settings FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER engagement_settings_updated BEFORE UPDATE ON public.engagement_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.engagement_settings(singleton) VALUES (true);

-- ============ STREAKS ============
CREATE TABLE public.user_streaks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_claim_date date,
  total_claimed_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_streaks TO authenticated;
GRANT ALL ON public.user_streaks TO service_role;
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own streak" ON public.user_streaks FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE TRIGGER user_streaks_updated BEFORE UPDATE ON public.user_streaks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.streak_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  day_number integer NOT NULL,
  amount_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, claim_date)
);
GRANT SELECT ON public.streak_claims TO authenticated;
GRANT ALL ON public.streak_claims TO service_role;
ALTER TABLE public.streak_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own streak claims" ON public.streak_claims FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- ============ LUCKY ============
CREATE TABLE public.lucky_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  amount_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, claim_date)
);
GRANT SELECT ON public.lucky_claims TO authenticated;
GRANT ALL ON public.lucky_claims TO service_role;
ALTER TABLE public.lucky_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own lucky claims" ON public.lucky_claims FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- ============ MYSTERY ============
CREATE TABLE public.mystery_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  outcome_label text NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_key)
);
GRANT SELECT ON public.mystery_claims TO authenticated;
GRANT ALL ON public.mystery_claims TO service_role;
ALTER TABLE public.mystery_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mystery claims" ON public.mystery_claims FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- ============ CHALLENGES ============
CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  metric text NOT NULL DEFAULT 'approved_jobs',
  target integer NOT NULL DEFAULT 5,
  reward_cents integer NOT NULL DEFAULT 50,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  active boolean NOT NULL DEFAULT true,
  require_kyc boolean NOT NULL DEFAULT false,
  min_approved_jobs integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read active challenges" ON public.challenges FOR SELECT TO authenticated USING (true);
CREATE POLICY "super admin manages challenges" ON public.challenges FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER challenges_updated BEFORE UPDATE ON public.challenges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.challenge_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);
GRANT SELECT ON public.challenge_claims TO authenticated;
GRANT ALL ON public.challenge_claims TO service_role;
ALTER TABLE public.challenge_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own challenge claims" ON public.challenge_claims FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- ============ BADGES ============
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'Award',
  metric text NOT NULL DEFAULT 'approved_jobs',
  threshold integer NOT NULL DEFAULT 1,
  reward_cents integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.badges TO authenticated, anon;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read badges" ON public.badges FOR SELECT USING (true);
CREATE POLICY "super admin manages badges" ON public.badges FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER badges_updated BEFORE UPDATE ON public.badges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.badges(slug,name,description,icon,metric,threshold,reward_cents,sort_order) VALUES
 ('first-job','First Job','Complete your first approved job','Sparkles','approved_jobs',1,0,1),
 ('ten-jobs','10 Jobs','Reach 10 approved jobs','Medal','approved_jobs',10,10,2),
 ('fifty-jobs','50 Jobs','Reach 50 approved jobs','Trophy','approved_jobs',50,50,3),
 ('hundred-jobs','100 Jobs','Reach 100 approved jobs','Crown','approved_jobs',100,150,4),
 ('verified-freelancer','Verified Freelancer','Complete identity verification','BadgeCheck','kyc_approved',1,0,5),
 ('top-referrer','Top Referrer','Refer 5 members who join Zurify','Gift','referrals',5,25,6),
 ('streak-30','30-Day Streak','Maintain a 30-day login streak','Flame','streak',30,100,7),
 ('first-payout','First Payout','Receive your first approved withdrawal','Banknote','withdrawals',1,0,8),
 ('top-rated','Top Rated','Reach a 4-star rating','Star','stars',4,0,9),
 ('elite','Elite Freelancer','Reach a 5-star rating','Gem','stars',5,0,10);

CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id)
);
GRANT SELECT ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read user badges" ON public.user_badges FOR SELECT TO authenticated USING (true);

-- ============ ZURIFY PRO ============
CREATE TABLE public.pro_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  note text,
  payment_reference text,
  price_cents integer NOT NULL DEFAULT 0,
  duration_days integer NOT NULL DEFAULT 30,
  reviewer_id uuid REFERENCES auth.users(id),
  admin_notes text,
  activated_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pro_requests TO authenticated;
GRANT ALL ON public.pro_requests TO service_role;
ALTER TABLE public.pro_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pro requests" ON public.pro_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE TRIGGER pro_requests_updated BEFORE UPDATE ON public.pro_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PLATFORM EVENTS ============
CREATE TABLE public.platform_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  banner_text text,
  accent text NOT NULL DEFAULT 'primary',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_events TO authenticated, anon;
GRANT ALL ON public.platform_events TO service_role;
ALTER TABLE public.platform_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read events" ON public.platform_events FOR SELECT USING (true);
CREATE POLICY "super admin manages events" ON public.platform_events FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER platform_events_updated BEFORE UPDATE ON public.platform_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ HELPERS ============
CREATE OR REPLACE FUNCTION public.credit_engagement_reward(_user_id uuid, _cents integer, _memo text, _ref_type text, _ref_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE w RECORD; new_bal integer;
BEGIN
  IF _cents IS NULL OR _cents <= 0 THEN RETURN; END IF;
  SELECT * INTO w FROM public.wallets WHERE user_id=_user_id FOR UPDATE;
  IF NOT FOUND THEN INSERT INTO public.wallets(user_id) VALUES (_user_id) RETURNING * INTO w; END IF;
  new_bal := w.available_cents + _cents;
  UPDATE public.wallets SET available_cents=new_bal, lifetime_earned_cents=lifetime_earned_cents+_cents WHERE id=w.id;
  INSERT INTO public.wallet_transactions(wallet_id,user_id,type,amount_cents,balance_after_cents,reference_type,reference_id,memo)
    VALUES (w.id,_user_id,'earning',_cents,new_bal,_ref_type,_ref_id,_memo);
END; $$;

CREATE OR REPLACE FUNCTION public.get_user_reputation(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s RECORD; approved int; rejected int; completed int; total int; rate numeric;
        kyc_ok boolean; clean boolean; age_days int; payouts int; recent int;
        score numeric := 0; wsum numeric; stars int := 1; label text; th jsonb;
BEGIN
  SELECT * INTO s FROM public.engagement_settings WHERE singleton=true;
  SELECT count(*) FILTER (WHERE status='approved'), count(*) FILTER (WHERE status='rejected'), count(*)
    INTO approved, rejected, completed FROM public.task_submissions WHERE user_id=_user_id;
  total := approved + rejected;
  rate := CASE WHEN total=0 THEN 0 ELSE (approved::numeric*100/total) END;
  kyc_ok := EXISTS (SELECT 1 FROM public.kyc_verifications WHERE user_id=_user_id AND status='approved');
  clean := NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=_user_id AND (suspended OR withdrawal_hold));
  SELECT COALESCE(EXTRACT(DAY FROM (now()-created_at))::int,0) INTO age_days FROM public.profiles WHERE id=_user_id;
  SELECT count(*) INTO payouts FROM public.withdrawal_requests WHERE user_id=_user_id AND status='approved';
  SELECT count(*) INTO recent FROM public.audit_logs WHERE actor_id=_user_id AND created_at >= now()-interval '14 days';

  wsum := GREATEST(1, s.rep_w_approval_rate+s.rep_w_approved_jobs+s.rep_w_completed_jobs+s.rep_w_kyc
        + s.rep_w_account_age+s.rep_w_withdrawals+s.rep_w_clean_record+s.rep_w_recent_activity);
  score := s.rep_w_approval_rate * LEAST(rate,100)/100
         + s.rep_w_approved_jobs * LEAST(approved,100)::numeric/100
         + s.rep_w_completed_jobs * LEAST(completed,100)::numeric/100
         + s.rep_w_kyc * (CASE WHEN kyc_ok THEN 1 ELSE 0 END)
         + s.rep_w_account_age * LEAST(age_days,180)::numeric/180
         + s.rep_w_withdrawals * LEAST(payouts,10)::numeric/10
         + s.rep_w_clean_record * (CASE WHEN clean THEN 1 ELSE 0 END)
         + s.rep_w_recent_activity * LEAST(recent,20)::numeric/20;
  score := round(score*100/wsum);

  label := s.rep_star1_label;
  FOR th IN SELECT * FROM jsonb_array_elements(s.rep_star_thresholds) LOOP
    IF approved >= COALESCE((th->>'min_approved')::int,0)
       AND rate >= COALESCE((th->>'min_rate')::numeric,0)
       AND score >= COALESCE((th->>'min_score')::numeric,0)
       AND (NOT COALESCE((th->>'require_kyc')::boolean,false) OR kyc_ok)
       AND (NOT COALESCE((th->>'require_clean')::boolean,false) OR clean)
       AND COALESCE((th->>'stars')::int,1) > stars THEN
      stars := (th->>'stars')::int;
      label := COALESCE(th->>'label', label);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('trust_score',GREATEST(1,LEAST(100,score::int)),'stars',stars,'label',label,
    'approved_jobs',approved,'rejected_jobs',rejected,'total_submissions',completed,
    'approval_rate',round(rate)::int,'kyc_verified',kyc_ok,'clean_record',clean,
    'account_age_days',age_days,'withdrawals',payouts,'recent_actions',recent);
END; $$;

CREATE OR REPLACE FUNCTION public.sync_my_badges()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE b RECORD; rep jsonb; val int; awarded int := 0; st RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  rep := public.get_user_reputation(auth.uid());
  SELECT * INTO st FROM public.user_streaks WHERE user_id=auth.uid();
  FOR b IN SELECT * FROM public.badges WHERE active LOOP
    IF EXISTS (SELECT 1 FROM public.user_badges WHERE user_id=auth.uid() AND badge_id=b.id) THEN CONTINUE; END IF;
    val := CASE b.metric
      WHEN 'approved_jobs' THEN (rep->>'approved_jobs')::int
      WHEN 'stars' THEN (rep->>'stars')::int
      WHEN 'kyc_approved' THEN CASE WHEN (rep->>'kyc_verified')::boolean THEN 1 ELSE 0 END
      WHEN 'withdrawals' THEN (rep->>'withdrawals')::int
      WHEN 'streak' THEN COALESCE(st.longest_streak,0)
      WHEN 'referrals' THEN (SELECT count(*)::int FROM public.referral_uses WHERE owner_user_id=auth.uid())
      ELSE 0 END;
    IF val >= b.threshold THEN
      INSERT INTO public.user_badges(user_id,badge_id) VALUES (auth.uid(),b.id) ON CONFLICT DO NOTHING;
      awarded := awarded + 1;
      IF b.reward_cents > 0 THEN
        PERFORM public.credit_engagement_reward(auth.uid(), b.reward_cents, 'Badge reward: '||b.name, 'badges', b.id);
      END IF;
      INSERT INTO public.notifications(user_id,type,title,body,link)
        VALUES (auth.uid(),'system','Achievement unlocked: '||b.name, b.description, '/dashboard');
    END IF;
  END LOOP;
  RETURN awarded;
END; $$;

-- ============ CLAIM FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.claim_daily_streak()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s RECORD; st RECORD; today date := (now() AT TIME ZONE 'utc')::date;
        gap int; next_day int; reward int; approved_recent int; required int; idx int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public.is_suspended(auth.uid()) THEN RAISE EXCEPTION 'Account is suspended'; END IF;
  SELECT * INTO s FROM public.engagement_settings WHERE singleton=true;
  IF NOT s.streak_enabled THEN RAISE EXCEPTION 'Daily streak is disabled'; END IF;

  SELECT * INTO st FROM public.user_streaks WHERE user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN INSERT INTO public.user_streaks(user_id) VALUES (auth.uid()) RETURNING * INTO st; END IF;
  IF st.last_claim_date = today THEN RAISE EXCEPTION 'Already claimed today'; END IF;

  gap := CASE WHEN st.last_claim_date IS NULL THEN 999 ELSE today - st.last_claim_date END;
  IF gap <= 1 + s.streak_grace_days THEN next_day := st.current_streak + 1; ELSE next_day := 1; END IF;
  IF next_day > 30 THEN
    IF s.streak_after_30 = 'loop' THEN next_day := 1; ELSE next_day := 30; END IF;
  END IF;

  required := CASE WHEN next_day <= 7 THEN 0 WHEN next_day <= 14 THEN s.streak_stage2_required_jobs ELSE s.streak_stage3_required_jobs END;
  IF required > 0 THEN
    SELECT count(*) INTO approved_recent FROM public.task_submissions
      WHERE user_id=auth.uid() AND status='approved' AND reviewed_at >= now()-interval '7 days';
    IF approved_recent < required THEN
      RAISE EXCEPTION 'You need % approved job(s) in the last 7 days to continue this streak (you have %)', required, approved_recent;
    END IF;
  END IF;

  IF next_day <= 7 THEN idx := next_day; reward := COALESCE(s.streak_stage1_rewards[idx],0);
  ELSIF next_day <= 14 THEN idx := next_day-7; reward := COALESCE(s.streak_stage2_rewards[idx],0);
  ELSE idx := next_day-14; reward := COALESCE(s.streak_stage3_rewards[idx], s.streak_stage3_rewards[array_length(s.streak_stage3_rewards,1)],0); END IF;
  reward := LEAST(reward, s.streak_max_reward_cents);

  INSERT INTO public.streak_claims(user_id,claim_date,day_number,amount_cents)
    VALUES (auth.uid(),today,next_day,reward);
  UPDATE public.user_streaks SET current_streak=next_day, longest_streak=GREATEST(longest_streak,next_day),
    last_claim_date=today, total_claimed_cents=total_claimed_cents+reward WHERE user_id=auth.uid();
  PERFORM public.credit_engagement_reward(auth.uid(), reward, 'Daily streak day '||next_day, 'streak_claims', NULL);
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'claim_streak','user_streaks',auth.uid(),jsonb_build_object('day',next_day,'amount_cents',reward));
  RETURN jsonb_build_object('day',next_day,'amount_cents',reward);
END; $$;

CREATE OR REPLACE FUNCTION public.claim_lucky_reward()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s RECORD; today date := (now() AT TIME ZONE 'utc')::date; nowt time := (now() AT TIME ZONE 'utc')::time;
        opens time; closes_min int; winners int; approved int; last_claim date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public.is_suspended(auth.uid()) THEN RAISE EXCEPTION 'Account is suspended'; END IF;
  SELECT * INTO s FROM public.engagement_settings WHERE singleton=true;
  IF NOT s.lucky_enabled THEN RAISE EXCEPTION 'Lucky reward is disabled'; END IF;
  opens := s.lucky_open_time;
  closes_min := EXTRACT(HOUR FROM opens)::int*60 + EXTRACT(MINUTE FROM opens)::int + s.lucky_duration_minutes;
  IF (EXTRACT(HOUR FROM nowt)::int*60 + EXTRACT(MINUTE FROM nowt)::int) NOT BETWEEN
     (EXTRACT(HOUR FROM opens)::int*60 + EXTRACT(MINUTE FROM opens)::int) AND closes_min THEN
    RAISE EXCEPTION 'The lucky reward window is closed';
  END IF;
  IF s.lucky_require_kyc AND NOT EXISTS (SELECT 1 FROM public.kyc_verifications WHERE user_id=auth.uid() AND status='approved') THEN
    RAISE EXCEPTION 'Identity verification required'; END IF;
  IF s.lucky_min_approved_jobs > 0 THEN
    SELECT count(*) INTO approved FROM public.task_submissions WHERE user_id=auth.uid() AND status='approved';
    IF approved < s.lucky_min_approved_jobs THEN RAISE EXCEPTION 'You need % approved job(s) to be eligible', s.lucky_min_approved_jobs; END IF;
  END IF;
  SELECT max(claim_date) INTO last_claim FROM public.lucky_claims WHERE user_id=auth.uid();
  IF last_claim IS NOT NULL AND today - last_claim < GREATEST(s.lucky_cooldown_days,1) THEN
    RAISE EXCEPTION 'You already claimed. Come back in % day(s)', GREATEST(s.lucky_cooldown_days,1) - (today - last_claim);
  END IF;
  SELECT count(*) INTO winners FROM public.lucky_claims WHERE claim_date=today;
  IF winners >= s.lucky_max_winners THEN RAISE EXCEPTION 'All lucky rewards for today have been claimed'; END IF;
  INSERT INTO public.lucky_claims(user_id,claim_date,amount_cents) VALUES (auth.uid(),today,s.lucky_reward_cents);
  PERFORM public.credit_engagement_reward(auth.uid(), s.lucky_reward_cents, 'Lucky reward window', 'lucky_claims', NULL);
  RETURN jsonb_build_object('amount_cents',s.lucky_reward_cents);
END; $$;

CREATE OR REPLACE FUNCTION public.open_mystery_box()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s RECORD; pkey text; approved int; total_w numeric := 0; roll numeric; acc numeric := 0;
        o jsonb; chosen jsonb; amount int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public.is_suspended(auth.uid()) THEN RAISE EXCEPTION 'Account is suspended'; END IF;
  SELECT * INTO s FROM public.engagement_settings WHERE singleton=true;
  IF NOT s.mystery_enabled THEN RAISE EXCEPTION 'Mystery box is disabled'; END IF;
  IF s.mystery_require_kyc AND NOT EXISTS (SELECT 1 FROM public.kyc_verifications WHERE user_id=auth.uid() AND status='approved') THEN
    RAISE EXCEPTION 'Identity verification required'; END IF;
  IF s.mystery_min_approved_jobs > 0 THEN
    SELECT count(*) INTO approved FROM public.task_submissions WHERE user_id=auth.uid() AND status='approved';
    IF approved < s.mystery_min_approved_jobs THEN RAISE EXCEPTION 'You need % approved job(s) to open a box', s.mystery_min_approved_jobs; END IF;
  END IF;
  pkey := (floor(EXTRACT(EPOCH FROM now()) / (GREATEST(s.mystery_frequency_days,1)*86400)))::text;
  IF EXISTS (SELECT 1 FROM public.mystery_claims WHERE user_id=auth.uid() AND period_key=pkey) THEN
    RAISE EXCEPTION 'You already opened your box for this period'; END IF;

  FOR o IN SELECT * FROM jsonb_array_elements(s.mystery_outcomes) LOOP total_w := total_w + COALESCE((o->>'weight')::numeric,0); END LOOP;
  IF total_w <= 0 THEN RAISE EXCEPTION 'No mystery outcomes configured'; END IF;
  roll := random() * total_w;
  FOR o IN SELECT * FROM jsonb_array_elements(s.mystery_outcomes) LOOP
    acc := acc + COALESCE((o->>'weight')::numeric,0);
    IF roll <= acc AND chosen IS NULL THEN chosen := o; END IF;
  END LOOP;
  amount := COALESCE((chosen->>'min_cents')::int,0);
  IF COALESCE((chosen->>'max_cents')::int,0) > amount THEN
    amount := amount + floor(random() * ((chosen->>'max_cents')::int - amount + 1))::int;
  END IF;
  INSERT INTO public.mystery_claims(user_id,period_key,outcome_label,amount_cents)
    VALUES (auth.uid(),pkey,COALESCE(chosen->>'label','Reward'),amount);
  PERFORM public.credit_engagement_reward(auth.uid(), amount, 'Mystery box: '||COALESCE(chosen->>'label','Reward'), 'mystery_claims', NULL);
  RETURN jsonb_build_object('label',COALESCE(chosen->>'label','Reward'),'amount_cents',amount);
END; $$;

CREATE OR REPLACE FUNCTION public.challenge_progress(_user_id uuid, _c public.challenges)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v int := 0;
BEGIN
  IF _c.metric = 'approved_jobs' THEN
    SELECT count(*) INTO v FROM public.task_submissions WHERE user_id=_user_id AND status='approved'
      AND reviewed_at BETWEEN _c.starts_at AND _c.ends_at;
  ELSIF _c.metric = 'submissions' THEN
    SELECT count(*) INTO v FROM public.task_submissions WHERE user_id=_user_id
      AND created_at BETWEEN _c.starts_at AND _c.ends_at;
  ELSIF _c.metric = 'referrals' THEN
    SELECT count(*) INTO v FROM public.referral_uses WHERE owner_user_id=_user_id
      AND applied_at BETWEEN _c.starts_at AND _c.ends_at;
  ELSIF _c.metric = 'earned_cents' THEN
    SELECT COALESCE(sum(amount_cents),0) INTO v FROM public.wallet_transactions
      WHERE user_id=_user_id AND amount_cents > 0 AND created_at BETWEEN _c.starts_at AND _c.ends_at;
  ELSIF _c.metric = 'streak' THEN
    SELECT COALESCE(current_streak,0) INTO v FROM public.user_streaks WHERE user_id=_user_id;
  END IF;
  RETURN COALESCE(v,0);
END; $$;

CREATE OR REPLACE FUNCTION public.claim_challenge(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c public.challenges; s RECORD; prog int; approved int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public.is_suspended(auth.uid()) THEN RAISE EXCEPTION 'Account is suspended'; END IF;
  SELECT * INTO s FROM public.engagement_settings WHERE singleton=true;
  IF NOT s.challenges_enabled THEN RAISE EXCEPTION 'Challenges are disabled'; END IF;
  SELECT * INTO c FROM public.challenges WHERE id=_id;
  IF NOT FOUND OR NOT c.active THEN RAISE EXCEPTION 'Challenge not available'; END IF;
  IF now() < c.starts_at OR now() > c.ends_at THEN RAISE EXCEPTION 'Challenge is not running'; END IF;
  IF EXISTS (SELECT 1 FROM public.challenge_claims WHERE challenge_id=_id AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'Already claimed'; END IF;
  IF (c.require_kyc OR s.challenges_require_kyc) AND NOT EXISTS
     (SELECT 1 FROM public.kyc_verifications WHERE user_id=auth.uid() AND status='approved') THEN
    RAISE EXCEPTION 'Identity verification required'; END IF;
  IF c.min_approved_jobs > 0 THEN
    SELECT count(*) INTO approved FROM public.task_submissions WHERE user_id=auth.uid() AND status='approved';
    IF approved < c.min_approved_jobs THEN RAISE EXCEPTION 'You need % approved job(s) to be eligible', c.min_approved_jobs; END IF;
  END IF;
  prog := public.challenge_progress(auth.uid(), c);
  IF prog < c.target THEN RAISE EXCEPTION 'Challenge not completed yet (% of %)', prog, c.target; END IF;
  INSERT INTO public.challenge_claims(challenge_id,user_id,reward_cents) VALUES (_id,auth.uid(),c.reward_cents);
  PERFORM public.credit_engagement_reward(auth.uid(), c.reward_cents, 'Challenge reward: '||c.name, 'challenges', c.id);
  INSERT INTO public.notifications(user_id,type,title,body,link)
    VALUES (auth.uid(),'system','Challenge complete','You claimed "'||c.name||'".','/dashboard');
  RETURN jsonb_build_object('amount_cents',c.reward_cents);
END; $$;

-- ============ AGGREGATE READ ============
CREATE OR REPLACE FUNCTION public.get_my_engagement()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s RECORD; st RECORD; today date := (now() AT TIME ZONE 'utc')::date; pkey text;
        uid uuid := auth.uid(); res jsonb; gap int; next_day int; nreward int; idx int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO s FROM public.engagement_settings WHERE singleton=true;
  SELECT * INTO st FROM public.user_streaks WHERE user_id=uid;
  gap := CASE WHEN st.last_claim_date IS NULL THEN 999 ELSE today - st.last_claim_date END;
  IF gap <= 1 + s.streak_grace_days THEN next_day := COALESCE(st.current_streak,0) + 1; ELSE next_day := 1; END IF;
  IF next_day > 30 THEN next_day := CASE WHEN s.streak_after_30='loop' THEN 1 ELSE 30 END; END IF;
  IF next_day <= 7 THEN idx := next_day; nreward := COALESCE(s.streak_stage1_rewards[idx],0);
  ELSIF next_day <= 14 THEN idx := next_day-7; nreward := COALESCE(s.streak_stage2_rewards[idx],0);
  ELSE idx := next_day-14; nreward := COALESCE(s.streak_stage3_rewards[idx],0); END IF;
  nreward := LEAST(nreward, s.streak_max_reward_cents);
  pkey := (floor(EXTRACT(EPOCH FROM now()) / (GREATEST(s.mystery_frequency_days,1)*86400)))::text;

  res := jsonb_build_object(
    'settings', jsonb_build_object(
      'streak_enabled',s.streak_enabled,'lucky_enabled',s.lucky_enabled,'mystery_enabled',s.mystery_enabled,
      'challenges_enabled',s.challenges_enabled,'badges_enabled',s.badges_enabled,'pro_enabled',s.pro_enabled,
      'pro_price_cents',s.pro_price_cents,'pro_duration_days',s.pro_duration_days,'pro_benefits',to_jsonb(s.pro_benefits),
      'lucky_open_time',s.lucky_open_time::text,'lucky_duration_minutes',s.lucky_duration_minutes,
      'lucky_reward_cents',s.lucky_reward_cents,'lucky_max_winners',s.lucky_max_winners,
      'mystery_frequency_days',s.mystery_frequency_days,'streak_grace_days',s.streak_grace_days,
      'streak_stage2_required_jobs',s.streak_stage2_required_jobs,'streak_stage3_required_jobs',s.streak_stage3_required_jobs),
    'streak', jsonb_build_object(
      'current',COALESCE(st.current_streak,0),'longest',COALESCE(st.longest_streak,0),
      'last_claim_date',st.last_claim_date,'total_claimed_cents',COALESCE(st.total_claimed_cents,0),
      'claimed_today', st.last_claim_date = today, 'next_day',next_day,'next_reward_cents',nreward,
      'approved_last_7', (SELECT count(*) FROM public.task_submissions WHERE user_id=uid AND status='approved' AND reviewed_at >= now()-interval '7 days')),
    'lucky', jsonb_build_object(
      'claimed_today', EXISTS(SELECT 1 FROM public.lucky_claims WHERE user_id=uid AND claim_date=today),
      'winners_today', (SELECT count(*) FROM public.lucky_claims WHERE claim_date=today),
      'last_amount_cents', (SELECT amount_cents FROM public.lucky_claims WHERE user_id=uid ORDER BY claim_date DESC LIMIT 1)),
    'mystery', jsonb_build_object(
      'period_key',pkey,
      'opened', EXISTS(SELECT 1 FROM public.mystery_claims WHERE user_id=uid AND period_key=pkey),
      'last', (SELECT jsonb_build_object('label',outcome_label,'amount_cents',amount_cents,'created_at',created_at)
               FROM public.mystery_claims WHERE user_id=uid ORDER BY created_at DESC LIMIT 1)),
    'challenges', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id',c.id,'name',c.name,'description',c.description,'metric',c.metric,'target',c.target,
        'reward_cents',c.reward_cents,'ends_at',c.ends_at,'starts_at',c.starts_at,
        'progress',public.challenge_progress(uid,c),
        'claimed',EXISTS(SELECT 1 FROM public.challenge_claims cc WHERE cc.challenge_id=c.id AND cc.user_id=uid))
        ORDER BY c.ends_at)
      FROM public.challenges c WHERE c.active AND now() BETWEEN c.starts_at AND c.ends_at),'[]'::jsonb),
    'reputation', public.get_user_reputation(uid),
    'badges', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id',b.id,'slug',b.slug,'name',b.name,'description',b.description,'icon',b.icon,
        'threshold',b.threshold,'metric',b.metric,
        'earned_at',(SELECT ub.awarded_at FROM public.user_badges ub WHERE ub.badge_id=b.id AND ub.user_id=uid))
        ORDER BY b.sort_order)
      FROM public.badges b WHERE b.active AND b.visible),'[]'::jsonb),
    'pro', (SELECT jsonb_build_object('status',p.status,'expires_at',p.expires_at,'created_at',p.created_at)
            FROM public.pro_requests p WHERE p.user_id=uid ORDER BY p.created_at DESC LIMIT 1),
    'events', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'banner_text',e.banner_text,
        'description',e.description,'accent',e.accent,'ends_at',e.ends_at) ORDER BY e.ends_at)
      FROM public.platform_events e WHERE e.status='active' AND now() BETWEEN e.starts_at AND e.ends_at),'[]'::jsonb)
  );
  RETURN res;
END; $$;

-- ============ PRO ============
CREATE OR REPLACE FUNCTION public.request_pro(_note text, _payment_reference text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s RECORD; new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public.is_suspended(auth.uid()) THEN RAISE EXCEPTION 'Account is suspended'; END IF;
  SELECT * INTO s FROM public.engagement_settings WHERE singleton=true;
  IF NOT s.pro_enabled THEN RAISE EXCEPTION 'Zurify Pro is not available yet'; END IF;
  IF EXISTS (SELECT 1 FROM public.pro_requests WHERE user_id=auth.uid() AND status IN ('pending','active')) THEN
    RAISE EXCEPTION 'You already have a pending or active membership'; END IF;
  INSERT INTO public.pro_requests(user_id,note,payment_reference,price_cents,duration_days)
    VALUES (auth.uid(),_note,_payment_reference,s.pro_price_cents,s.pro_duration_days) RETURNING id INTO new_id;
  INSERT INTO public.notifications(user_id,type,title,body,link)
  SELECT ur.user_id,'system','New Zurify Pro request','A member requested Zurify Pro.','/admin/pro'
  FROM public.user_roles ur WHERE ur.role IN ('super_admin','admin');
  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_pro_requests()
RETURNS TABLE(id uuid, user_id uuid, full_name text, email text, status text, note text,
  payment_reference text, price_cents integer, duration_days integer, admin_notes text,
  activated_at timestamptz, expires_at timestamptz, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.id,p.user_id,pr.full_name,u.email::text,p.status,p.note,p.payment_reference,
    p.price_cents,p.duration_days,p.admin_notes,p.activated_at,p.expires_at,p.created_at
  FROM public.pro_requests p
  LEFT JOIN public.profiles pr ON pr.id=p.user_id
  LEFT JOIN auth.users u ON u.id=p.user_id
  WHERE public.is_super_admin(auth.uid())
  ORDER BY (p.status='pending') DESC, p.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_pro_status(_id uuid, _status text, _notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r RECORD;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF _status NOT IN ('pending','active','rejected','suspended','expired') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  SELECT * INTO r FROM public.pro_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  UPDATE public.pro_requests SET status=_status, admin_notes=_notes, reviewer_id=auth.uid(),
    activated_at = CASE WHEN _status='active' THEN now() ELSE activated_at END,
    expires_at = CASE WHEN _status='active' THEN now() + (duration_days||' days')::interval ELSE expires_at END
    WHERE id=_id;
  INSERT INTO public.notifications(user_id,type,title,body,link)
    VALUES (r.user_id,'system','Zurify Pro '||_status,'Your Zurify Pro membership is now '||_status||'.','/pro');
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'pro_'||_status,'pro_requests',_id,jsonb_build_object('user_id',r.user_id));
END; $$;

REVOKE EXECUTE ON FUNCTION public.credit_engagement_reward(uuid,integer,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_reputation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_my_badges() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_streak() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_lucky_reward() TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_mystery_box() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_challenge(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.challenge_progress(uuid, public.challenges) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_engagement() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_pro(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_pro_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_pro_status(uuid,text,text) TO authenticated;