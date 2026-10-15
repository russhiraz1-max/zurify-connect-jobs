-- Dedicated AI-company onboarding and data-project workflow.
-- Organizations remain pending until a staff reviewer verifies them. Projects
-- are drafts and cannot publish, reserve funds, accept workers, or export data
-- through this migration. Apply/test only in the isolated 2.0 database.

CREATE TABLE IF NOT EXISTS public.ai_company_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  legal_name text NOT NULL,
  website text,
  contact_email text NOT NULL,
  verification_status text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  verification_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_data_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.ai_company_organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  project_type text NOT NULL
    CHECK (project_type IN ('data_collection', 'transcription', 'pronunciation', 'labeling', 'evaluation', 'language_culture')),
  description text NOT NULL,
  instructions text NOT NULL,
  language text NOT NULL,
  dialect text,
  locale text,
  region text,
  expected_records integer NOT NULL DEFAULT 100
    CHECK (expected_records BETWEEN 1 AND 1000000),
  consent_required boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'active', 'completed', 'paused')),
  review_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_data_projects_org_created_idx
  ON public.ai_data_projects(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_data_projects_status_created_idx
  ON public.ai_data_projects(status, created_at DESC);

ALTER TABLE public.ai_company_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_data_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AI companies read own organization" ON public.ai_company_organizations;
CREATE POLICY "AI companies read own organization"
  ON public.ai_company_organizations FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff read all AI company organizations" ON public.ai_company_organizations;
CREATE POLICY "Staff read all AI company organizations"
  ON public.ai_company_organizations FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "AI companies read own projects" ON public.ai_data_projects;
CREATE POLICY "AI companies read own projects"
  ON public.ai_data_projects FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.ai_company_organizations o
      WHERE o.id = organization_id AND o.owner_user_id = auth.uid()
    )
  );

REVOKE ALL ON public.ai_company_organizations FROM anon, authenticated;
REVOKE ALL ON public.ai_data_projects FROM anon, authenticated;
GRANT SELECT ON public.ai_company_organizations, public.ai_data_projects TO authenticated;

-- Update the auth trigger only in this forward migration. OAuth accounts do
-- not trust user-editable account_type metadata; they must use the chooser.
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
  SELECT * INTO s FROM public.application_settings WHERE singleton = true LIMIT 1;

  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.wallets (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  IF s.super_admin_email IS NOT NULL AND lower(NEW.email) = lower(s.super_admin_email) THEN
    assigned := 'super_admin';
  END IF;

  requested_type := NEW.raw_user_meta_data->>'account_type';
  provider_name := NEW.raw_app_meta_data->>'provider';

  IF assigned = 'super_admin' THEN
    account_role := NULL;
  ELSIF provider_name = 'email' THEN
    IF requested_type IN ('job_seeker', 'employer', 'ai_company') THEN
      account_role := requested_type::public.app_role;
    ELSE
      account_role := 'job_seeker';
    END IF;
  ELSE
    account_role := NULL;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF account_role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, account_role)
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
  existing_role_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF _account_type IN ('job_seeker', 'employer', 'ai_company') THEN
    target_role := _account_type::public.app_role;
  ELSE
    RAISE EXCEPTION 'Choose a supported account type' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('super_admin', 'staff', 'admin', 'advertiser')
  ) THEN
    RAISE EXCEPTION 'Account-type onboarding is not available for this role' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role NOT IN ('user', 'job_seeker', 'employer', 'ai_company')
  ) THEN
    RAISE EXCEPTION 'Account has an unsupported role; contact support' USING ERRCODE = '42501';
  END IF;

  SELECT count(*), min(role::text)::public.app_role
    INTO existing_role_count, existing_role
  FROM public.user_roles
  WHERE user_id = auth.uid() AND role IN ('job_seeker', 'employer', 'ai_company');

  IF existing_role_count > 1 THEN
    RAISE EXCEPTION 'Account has conflicting account types; contact support' USING ERRCODE = '42501';
  ELSIF existing_role_count = 1 THEN
    IF existing_role = target_role THEN RETURN existing_role::text; END IF;
    RAISE EXCEPTION 'Account type has already been selected' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), target_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN target_role::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_account_type(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_account_type(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_ai_company_profile(
  _legal_name text,
  _website text,
  _contact_email text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'ai_company'::public.app_role) THEN
    RAISE EXCEPTION 'AI-company account required' USING ERRCODE = '42501';
  END IF;
  IF public.is_suspended(auth.uid()) THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;
  IF _legal_name IS NULL OR length(btrim(_legal_name)) < 2 OR length(_legal_name) > 160 THEN
    RAISE EXCEPTION 'Organization name must be between 2 and 160 characters';
  END IF;
  IF _contact_email IS NULL OR length(btrim(_contact_email)) > 254
     OR btrim(_contact_email) !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Enter a valid organization contact email';
  END IF;
  IF _website IS NOT NULL AND length(btrim(_website)) > 300 THEN
    RAISE EXCEPTION 'Website URL is too long';
  END IF;

  INSERT INTO public.ai_company_organizations(owner_user_id, legal_name, website, contact_email)
  VALUES (auth.uid(), btrim(_legal_name), NULLIF(btrim(_website), ''), lower(btrim(_contact_email)))
  ON CONFLICT (owner_user_id) DO UPDATE
    SET legal_name = EXCLUDED.legal_name,
        website = EXCLUDED.website,
        contact_email = EXCLUDED.contact_email,
        verification_status = CASE
          WHEN public.ai_company_organizations.verification_status = 'approved'
            AND public.ai_company_organizations.legal_name IS NOT DISTINCT FROM EXCLUDED.legal_name
            AND public.ai_company_organizations.website IS NOT DISTINCT FROM EXCLUDED.website
            AND public.ai_company_organizations.contact_email IS NOT DISTINCT FROM EXCLUDED.contact_email
            THEN 'approved'
          ELSE 'pending'
        END,
        verification_notes = CASE
          WHEN public.ai_company_organizations.legal_name IS DISTINCT FROM EXCLUDED.legal_name
            OR public.ai_company_organizations.website IS DISTINCT FROM EXCLUDED.website
            OR public.ai_company_organizations.contact_email IS DISTINCT FROM EXCLUDED.contact_email
            THEN NULL
          ELSE public.ai_company_organizations.verification_notes
        END,
        reviewed_by = CASE
          WHEN public.ai_company_organizations.legal_name IS DISTINCT FROM EXCLUDED.legal_name
            OR public.ai_company_organizations.website IS DISTINCT FROM EXCLUDED.website
            OR public.ai_company_organizations.contact_email IS DISTINCT FROM EXCLUDED.contact_email
            THEN NULL
          ELSE public.ai_company_organizations.reviewed_by
        END,
        reviewed_at = CASE
          WHEN public.ai_company_organizations.legal_name IS DISTINCT FROM EXCLUDED.legal_name
            OR public.ai_company_organizations.website IS DISTINCT FROM EXCLUDED.website
            OR public.ai_company_organizations.contact_email IS DISTINCT FROM EXCLUDED.contact_email
            THEN NULL
          ELSE public.ai_company_organizations.reviewed_at
        END,
        updated_at = now()
  RETURNING id INTO new_id;

  INSERT INTO public.audit_logs(actor_id, action, target_type, target_id, meta)
  VALUES (auth.uid(), 'create_ai_company_profile', 'ai_company_organizations', new_id,
    jsonb_build_object('verification_status', 'pending'));
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_ai_data_project(
  _title text,
  _project_type text,
  _description text,
  _instructions text,
  _language text,
  _dialect text DEFAULT NULL,
  _locale text DEFAULT NULL,
  _region text DEFAULT NULL,
  _expected_records integer DEFAULT 100,
  _consent_required boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE org_id uuid; project_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'ai_company'::public.app_role) THEN
    RAISE EXCEPTION 'AI-company account required' USING ERRCODE = '42501';
  END IF;
  IF public.is_suspended(auth.uid()) THEN RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501'; END IF;
  IF _title IS NULL OR length(btrim(_title)) < 4 OR length(_title) > 160 THEN
    RAISE EXCEPTION 'Project title must be between 4 and 160 characters';
  END IF;
  IF _project_type NOT IN ('data_collection', 'transcription', 'pronunciation', 'labeling', 'evaluation', 'language_culture') THEN
    RAISE EXCEPTION 'Choose a supported AI data project type';
  END IF;
  IF _description IS NULL OR length(btrim(_description)) < 20 OR length(_description) > 5000 THEN
    RAISE EXCEPTION 'Description must be between 20 and 5000 characters';
  END IF;
  IF _instructions IS NULL OR length(btrim(_instructions)) < 20 OR length(_instructions) > 10000 THEN
    RAISE EXCEPTION 'Instructions must be between 20 and 10000 characters';
  END IF;
  IF _language IS NULL OR length(btrim(_language)) < 2 OR length(_language) > 100 THEN
    RAISE EXCEPTION 'Language is required';
  END IF;
  IF _dialect IS NOT NULL AND length(_dialect) > 100 THEN RAISE EXCEPTION 'Dialect is too long'; END IF;
  IF _locale IS NOT NULL AND length(_locale) > 50 THEN RAISE EXCEPTION 'Locale is too long'; END IF;
  IF _region IS NOT NULL AND length(_region) > 100 THEN RAISE EXCEPTION 'Region is too long'; END IF;
  IF _expected_records IS NULL OR _expected_records < 1 OR _expected_records > 1000000 THEN
    RAISE EXCEPTION 'Expected record count must be between 1 and 1000000';
  END IF;
  IF _consent_required IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Contributor consent is required for AI data projects';
  END IF;

  SELECT id INTO org_id FROM public.ai_company_organizations WHERE owner_user_id = auth.uid();
  IF org_id IS NULL THEN RAISE EXCEPTION 'Complete organization details first'; END IF;

  INSERT INTO public.ai_data_projects(
    organization_id, title, project_type, description, instructions, language,
    dialect, locale, region, expected_records, consent_required, status, created_by
  )
  VALUES (
    org_id, btrim(_title), _project_type, btrim(_description), btrim(_instructions),
    btrim(_language), NULLIF(btrim(_dialect), ''), NULLIF(btrim(_locale), ''),
    NULLIF(btrim(_region), ''), _expected_records, true, 'draft', auth.uid()
  )
  RETURNING id INTO project_id;

  INSERT INTO public.audit_logs(actor_id, action, target_type, target_id, meta)
  VALUES (auth.uid(), 'create_ai_data_project', 'ai_data_projects', project_id,
    jsonb_build_object('status', 'draft', 'project_type', _project_type, 'expected_records', _expected_records));
  RETURN project_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_ai_company(
  _organization_id uuid,
  _decision text,
  _notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE prior_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Staff permission required' USING ERRCODE = '42501';
  END IF;
  IF _decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'Invalid review decision'; END IF;
  IF _notes IS NOT NULL AND length(_notes) > 2000 THEN RAISE EXCEPTION 'Review notes are too long'; END IF;

  UPDATE public.ai_company_organizations
    SET verification_status = _decision, verification_notes = NULLIF(btrim(_notes), ''),
        reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
    WHERE id = _organization_id
    RETURNING verification_status INTO prior_status;
  IF NOT FOUND THEN RAISE EXCEPTION 'Organization not found'; END IF;

  INSERT INTO public.audit_logs(actor_id, action, target_type, target_id, meta)
  VALUES (auth.uid(), 'review_ai_company', 'ai_company_organizations', _organization_id,
    jsonb_build_object('decision', _decision, 'notes_present', NULLIF(btrim(_notes), '') IS NOT NULL));
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_ai_project_for_review(_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE current_status text; org_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'ai_company'::public.app_role) THEN
    RAISE EXCEPTION 'AI-company account required' USING ERRCODE = '42501';
  END IF;
  SELECT p.status, o.verification_status
    INTO current_status, org_status
  FROM public.ai_data_projects p
  JOIN public.ai_company_organizations o ON o.id = p.organization_id
  WHERE p.id = _project_id AND o.owner_user_id = auth.uid()
  FOR UPDATE OF p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
  IF org_status <> 'approved' THEN RAISE EXCEPTION 'Organization verification is required before project review'; END IF;
  IF current_status NOT IN ('draft', 'rejected') THEN RAISE EXCEPTION 'Project cannot be submitted from its current status'; END IF;

  UPDATE public.ai_data_projects
    SET status = 'submitted', review_notes = NULL, reviewed_by = NULL, reviewed_at = NULL, updated_at = now()
  WHERE id = _project_id;

  INSERT INTO public.audit_logs(actor_id, action, target_type, target_id, meta)
  VALUES (auth.uid(), 'submit_ai_project_for_review', 'ai_data_projects', _project_id, jsonb_build_object('status', 'submitted'));
END;
$$;

CREATE OR REPLACE FUNCTION public.review_ai_data_project(
  _project_id uuid,
  _decision text,
  _notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE current_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Staff permission required' USING ERRCODE = '42501';
  END IF;
  IF _decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'Invalid review decision'; END IF;
  IF _notes IS NOT NULL AND length(_notes) > 2000 THEN RAISE EXCEPTION 'Review notes are too long'; END IF;

  SELECT status INTO current_status FROM public.ai_data_projects WHERE id = _project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
  IF current_status <> 'submitted' THEN RAISE EXCEPTION 'Only submitted projects can be reviewed'; END IF;

  UPDATE public.ai_data_projects
    SET status = _decision, review_notes = NULLIF(btrim(_notes), ''),
        reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  WHERE id = _project_id;

  INSERT INTO public.audit_logs(actor_id, action, target_type, target_id, meta)
  VALUES (auth.uid(), 'review_ai_data_project', 'ai_data_projects', _project_id,
    jsonb_build_object('decision', _decision, 'notes_present', NULLIF(btrim(_notes), '') IS NOT NULL));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_ai_company_profile(text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_ai_data_project(text, text, text, text, text, text, text, text, integer, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.review_ai_company(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_ai_project_for_review(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.review_ai_data_project(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_ai_company_profile(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_ai_data_project(text, text, text, text, text, text, text, text, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_ai_company(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_ai_project_for_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_ai_data_project(uuid, text, text) TO authenticated;
