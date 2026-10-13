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
  account_role public.app_role := 'job_seeker';
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

  -- Metadata is user-editable. It may choose only between these two
  -- non-privileged roles and can never grant admin, staff, or advertiser.
  IF NEW.raw_user_meta_data->>'account_type' = 'employer' THEN
    account_role := 'employer';
  ELSE
    account_role := 'job_seeker';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, account_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
