-- Zurify 2.0 security hardening: protect aggregate analytics and internal metrics.
-- Intended for an isolated 2.0 database first; do not apply to production yet.

-- The prior SQL SECURITY DEFINER implementation of admin_analytics_series had
-- no in-function authorization check. Execute was granted to authenticated,
-- which allowed any signed-in user to query aggregate financial/activity data.
CREATE OR REPLACE FUNCTION public.admin_analytics_series(_days integer DEFAULT 30)
RETURNS TABLE(
  day date,
  signups bigint,
  tasks_completed bigint,
  referrals bigint,
  revenue_cents bigint,
  expenses_cents bigint,
  profit_cents bigint,
  withdrawals bigint,
  payout_cents bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE safe_days integer := LEAST(GREATEST(COALESCE(_days, 30), 1), 365);
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;

  RETURN QUERY
  WITH d AS (
    SELECT generate_series(
      date_trunc('day', now()) - ((safe_days - 1) || ' days')::interval,
      date_trunc('day', now()),
      '1 day'
    )::date AS day
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
END;
$$;

-- These SECURITY DEFINER helpers are only called by protected aggregate/claim
-- RPCs in the checked-in source. Keep them non-callable directly by API roles;
-- the SECURITY DEFINER owner can still invoke them internally.
REVOKE ALL ON FUNCTION public.get_user_reputation(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.challenge_progress(uuid, public.challenges) FROM PUBLIC, anon, authenticated;
