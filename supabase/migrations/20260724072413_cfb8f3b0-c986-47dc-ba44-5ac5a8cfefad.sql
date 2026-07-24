
-- Fix profile SELECT policy: only owner or staff can read full profile
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Profiles readable by owner or staff" ON public.profiles;
CREATE POLICY "Profiles readable by owner or staff" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_staff(auth.uid()));

-- Referral leaderboard (public: usernames only, no emails)
CREATE OR REPLACE FUNCTION public.get_referral_leaderboard(_limit integer DEFAULT 20)
RETURNS TABLE(rank bigint, owner_user_id uuid, display_name text, successful_referrals bigint, commission_earned_cents bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ranked AS (
    SELECT c.owner_user_id,
      COALESCE(NULLIF(p.full_name,''), 'Member') AS display_name,
      COUNT(ru.id) FILTER (WHERE ru.bonus_awarded_at IS NOT NULL) AS successful_referrals,
      COALESCE(SUM(ru.total_commission_cents),0)::bigint AS commission_earned_cents
    FROM public.referral_codes c
    LEFT JOIN public.referral_uses ru ON ru.code_id = c.id
    LEFT JOIN public.profiles p ON p.id = c.owner_user_id
    WHERE c.status = 'active'
    GROUP BY c.owner_user_id, p.full_name
  )
  SELECT ROW_NUMBER() OVER (ORDER BY successful_referrals DESC, commission_earned_cents DESC) AS rank,
    owner_user_id, display_name, successful_referrals, commission_earned_cents
  FROM ranked
  WHERE successful_referrals > 0
  ORDER BY successful_referrals DESC, commission_earned_cents DESC
  LIMIT COALESCE(_limit, 20);
$$;

REVOKE EXECUTE ON FUNCTION public.get_referral_leaderboard(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_referral_leaderboard(integer) TO anon, authenticated;

-- Referral timeline for current user's owned code
CREATE OR REPLACE FUNCTION public.get_my_referral_timeline(_limit integer DEFAULT 50)
RETURNS TABLE(event_at timestamptz, kind text, actor_name text, amount_cents integer, memo text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH my_code AS (SELECT id FROM public.referral_codes WHERE owner_user_id = auth.uid())
  SELECT * FROM (
    -- Joined
    SELECT ru.applied_at AS event_at, 'joined'::text AS kind,
      COALESCE(NULLIF(p.full_name,''),'Member') AS actor_name,
      0::integer AS amount_cents, 'Joined via your code'::text AS memo
    FROM public.referral_uses ru
    LEFT JOIN public.profiles p ON p.id = ru.referred_user_id
    WHERE ru.code_id IN (SELECT id FROM my_code)
    UNION ALL
    -- Welcome bonus awarded
    SELECT ru.bonus_awarded_at AS event_at, 'welcome_bonus'::text,
      COALESCE(NULLIF(p.full_name,''),'Member'),
      ru.bonus_amount_cents, 'Welcome bonus awarded (first approved task)'::text
    FROM public.referral_uses ru
    LEFT JOIN public.profiles p ON p.id = ru.referred_user_id
    WHERE ru.code_id IN (SELECT id FROM my_code) AND ru.bonus_awarded_at IS NOT NULL
    UNION ALL
    -- Commission transactions to owner from referred users' withdrawals
    SELECT wt.created_at AS event_at, 'commission'::text,
      COALESCE(NULLIF(p.full_name,''),'Member'),
      wt.amount_cents, wt.memo
    FROM public.wallet_transactions wt
    JOIN public.withdrawal_requests wr ON wr.id::text = wt.reference_id::text
    JOIN public.referral_uses ru ON ru.referred_user_id = wr.user_id AND ru.code_id IN (SELECT id FROM my_code)
    LEFT JOIN public.profiles p ON p.id = wr.user_id
    WHERE wt.user_id = auth.uid() AND wt.type = 'referral_commission'
  ) t
  WHERE event_at IS NOT NULL
  ORDER BY event_at DESC
  LIMIT COALESCE(_limit, 50);
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_referral_timeline(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_referral_timeline(integer) TO authenticated;
