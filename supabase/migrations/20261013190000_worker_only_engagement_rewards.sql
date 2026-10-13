-- Zurify 2.0: enforce freelancer-only engagement rewards at the database boundary.
-- Claim RPCs are SECURITY DEFINER and historically checked authentication and
-- suspension, but not the account type. Triggers guard their durable claim rows
-- so clients cannot collect worker rewards by calling RPCs directly.
-- Source-only until tested on a disposable Supabase database.

CREATE OR REPLACE FUNCTION public.guard_worker_reward_claim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Allow trusted server/migration operations, but reject anonymous API writes.
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    IF auth.role() = 'anon' THEN
      RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cannot claim rewards for another account' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_role(auth.uid(), 'job_seeker'::public.app_role)
     OR public.has_role(auth.uid(), 'employer'::public.app_role)
     OR public.has_role(auth.uid(), 'staff'::public.app_role)
     OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
     OR public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'advertiser'::public.app_role) THEN
    RAISE EXCEPTION 'Freelancer account required for engagement rewards' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_worker_reward_claim() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_worker_streak_claim ON public.streak_claims;
CREATE TRIGGER guard_worker_streak_claim
  BEFORE INSERT ON public.streak_claims
  FOR EACH ROW EXECUTE FUNCTION public.guard_worker_reward_claim();

DROP TRIGGER IF EXISTS guard_worker_lucky_claim ON public.lucky_claims;
CREATE TRIGGER guard_worker_lucky_claim
  BEFORE INSERT ON public.lucky_claims
  FOR EACH ROW EXECUTE FUNCTION public.guard_worker_reward_claim();

DROP TRIGGER IF EXISTS guard_worker_mystery_claim ON public.mystery_claims;
CREATE TRIGGER guard_worker_mystery_claim
  BEFORE INSERT ON public.mystery_claims
  FOR EACH ROW EXECUTE FUNCTION public.guard_worker_reward_claim();

DROP TRIGGER IF EXISTS guard_worker_challenge_claim ON public.challenge_claims;
CREATE TRIGGER guard_worker_challenge_claim
  BEFORE INSERT ON public.challenge_claims
  FOR EACH ROW EXECUTE FUNCTION public.guard_worker_reward_claim();

DROP TRIGGER IF EXISTS guard_worker_badge_award ON public.user_badges;
CREATE TRIGGER guard_worker_badge_award
  BEFORE INSERT ON public.user_badges
  FOR EACH ROW EXECUTE FUNCTION public.guard_worker_reward_claim();
