-- Zurify 2.0: persist the signup intent as a non-privileged app role.
-- The only values accepted from user-editable auth metadata are job_seeker and
-- employer. Admin/staff roles continue to be assigned only by the existing
-- trusted super-admin bootstrap and staff-control workflows.
-- Test the full migration chain on a disposable database before production use.

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

  -- Account type metadata is user-editable. Only the email/password signup
  -- flow currently presents the account-type choice before trigger execution.
  -- OAuth providers always go through the authenticated post-OAuth chooser,
  -- even if provider/user metadata happens to contain an account_type value.
  IF NEW.raw_app_meta_data->>'provider' = 'email' THEN
    IF NEW.raw_user_meta_data->>'account_type' = 'employer' THEN
      account_role := 'employer';
    ELSIF NEW.raw_user_meta_data->>'account_type' = 'job_seeker' THEN
      account_role := 'job_seeker';
    ELSE
      -- Email/password signup defaults safely to a worker account if metadata
      -- is missing or malformed.
      account_role := 'job_seeker';
    END IF;
  ELSE
    -- Unknown/missing provider metadata fails closed to the chooser.
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
