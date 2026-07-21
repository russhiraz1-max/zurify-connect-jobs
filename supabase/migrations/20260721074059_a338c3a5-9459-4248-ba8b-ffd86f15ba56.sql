
-- 1. application_settings: only super_admin can SELECT directly
DROP POLICY IF EXISTS "settings readable" ON public.application_settings;
CREATE POLICY "super admin reads settings"
  ON public.application_settings FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Safe accessor for authenticated users (used by withdrawal form)
CREATE OR REPLACE FUNCTION public.get_withdrawal_settings()
RETURNS TABLE (
  min_withdrawal_cents integer,
  withdrawal_unit_cents integer,
  fee_bps_per_unit integer,
  paypal_instructions text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT min_withdrawal_cents, withdrawal_unit_cents, fee_bps_per_unit, paypal_instructions
  FROM public.application_settings WHERE singleton = true LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_withdrawal_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_withdrawal_settings() TO authenticated;

-- 2. profiles: authenticated-only reads
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- 3. Revoke anon EXECUTE from privileged action functions
REVOKE EXECUTE ON FUNCTION public.apply_to_task(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_application(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_task(uuid, text, text, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_submission(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_submission(uuid, text, boolean) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_application(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_application(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal(integer, withdrawal_method, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_withdrawal(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.quote_withdrawal_fee(integer) FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.apply_to_task(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_application(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_task(uuid, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_submission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_submission(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_application(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_application(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(integer, withdrawal_method, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quote_withdrawal_fee(integer) TO authenticated;

-- has_role/is_staff/is_super_admin/has_staff_permission remain executable to
-- authenticated because they are called inside RLS policies via the caller's
-- role; the functions themselves only read the caller's own roles.
