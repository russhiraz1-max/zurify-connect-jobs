-- Zurify 2.0: OAuth signups without trusted account_type metadata must
-- explicitly choose a non-privileged account type after authentication.
-- Source-only until tested on an isolated Supabase project.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s RECORD;
  assigned public.app_role := 'user';
  account_role public.app_role;
  requested_type text;
  provider_name text;
BEGIN
  SELECT * INTO s
  FROM public.application_settings
  WHERE singleton = true
  LIMIT 1;

  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  IF s.super_admin_email IS NOT NULL
     AND lower(NEW.email) = lower(s.super_admin_email) THEN
    assigned := 'super_admin';
  END IF;

  requested_type := NEW.raw_user_meta_data->>'account_type';
  provider_name := NEW.raw_app_meta_data->>'provider';

  IF requested_type = 'employer' THEN
    account_role := 'employer';
  ELSIF requested_type = 'job_seeker' THEN
    account_role := 'job_seeker';
  ELSIF provider_name = 'email' THEN
    -- Preserve the existing default for email/password signup.
    account_role := 'job_seeker';
  ELSE
    -- OAuth signup without explicit role metadata must complete onboarding.
    account_role := NULL;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF account_role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, account_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_account_type(_account_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_role public.app_role;
  existing_role public.app_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF _account_type = 'employer' THEN
    target_role := 'employer';
  ELSIF _account_type = 'job_seeker' THEN
    target_role := 'job_seeker';
  ELSE
    RAISE EXCEPTION 'Choose a supported account type' USING ERRCODE = '22023';
  END IF;

  -- Serialize repeated onboarding submissions for the same account.
  PERFORM 1 FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'staff', 'admin', 'advertiser')
  ) THEN
    RAISE EXCEPTION 'Account-type onboarding is not available for this role' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO existing_role
  FROM public.user_roles
  WHERE user_id = auth.uid()
    AND role IN ('job_seeker', 'employer')
  LIMIT 1;

  IF FOUND THEN
    IF existing_role = target_role THEN
      RETURN existing_role::text;
    END IF;
    RAISE EXCEPTION 'Account type has already been selected' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), target_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN target_role::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_account_type(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_account_type(text) TO authenticated;
