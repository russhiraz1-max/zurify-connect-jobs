-- Complete post-OAuth account selection for users whose auth metadata did not
-- contain an account_type. Only the two ordinary account types are assignable.
-- The profile row is locked so concurrent requests cannot add both roles.
-- Test the complete migration chain and OAuth flow on a disposable database.

CREATE OR REPLACE FUNCTION public.complete_account_type(_account_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  requested_role public.app_role;
  existing_role public.app_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF _account_type IS NULL OR _account_type NOT IN ('job_seeker', 'employer') THEN
    RAISE EXCEPTION 'Choose a valid account type' USING ERRCODE = '22023';
  END IF;

  requested_role := _account_type::public.app_role;

  -- This stable per-user row serializes simultaneous first-time selections.
  PERFORM 1
    FROM public.profiles
    WHERE id = auth.uid()
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = '42501';
  END IF;

  -- Special/privileged accounts must not use ordinary onboarding to mutate roles.
  IF EXISTS (
    SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin', 'admin', 'staff', 'advertiser')
  ) THEN
    RAISE EXCEPTION 'This account cannot use ordinary account onboarding' USING ERRCODE = '42501';
  END IF;

  SELECT role
    INTO existing_role
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('job_seeker', 'employer')
    LIMIT 1;

  IF FOUND THEN
    IF existing_role <> requested_role THEN
      RAISE EXCEPTION 'Account type is already set and cannot be changed here' USING ERRCODE = '42501';
    END IF;
    RETURN;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), requested_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_account_type(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_account_type(text) TO authenticated;
