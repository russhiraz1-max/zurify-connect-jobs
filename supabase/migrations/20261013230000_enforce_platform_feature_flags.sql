-- Feature flags must be enforced at the database boundary, not only in UI.
-- Missing configuration fails closed for gated customer-facing creation paths.

CREATE OR REPLACE FUNCTION public.is_platform_feature_enabled(_flag text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((
    SELECT (feature_flags ->> _flag)::boolean
    FROM public.platform_configuration
    WHERE singleton = true
  ), false)
$$;

REVOKE EXECUTE ON FUNCTION public.is_platform_feature_enabled(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_feature_enabled(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_client_draft_feature_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL
     AND public.has_role(NEW.created_by, 'employer'::public.app_role)
     AND NOT public.is_platform_feature_enabled('client_drafts') THEN
    RAISE EXCEPTION 'Client draft creation is temporarily disabled' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_client_draft_feature_flag ON public.tasks;
CREATE TRIGGER guard_client_draft_feature_flag
  BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.guard_client_draft_feature_flag();

CREATE OR REPLACE FUNCTION public.guard_ai_company_feature_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE owner_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'ai_company_organizations' THEN
    owner_id := NEW.owner_user_id;
  ELSE
    SELECT owner_user_id INTO owner_id
    FROM public.ai_company_organizations
    WHERE id = NEW.organization_id;
  END IF;

  -- Allow staff reviewers to complete moderation even if new AI-company
  -- project creation has been disabled by the super admin.
  IF NOT public.is_staff(auth.uid())
     AND owner_id IS NOT NULL
     AND public.has_role(owner_id, 'ai_company'::public.app_role)
     AND NOT public.is_platform_feature_enabled('ai_company_workspace') THEN
    RAISE EXCEPTION 'AI-company workspace is temporarily disabled' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_ai_company_organization_feature_flag ON public.ai_company_organizations;
CREATE TRIGGER guard_ai_company_organization_feature_flag
  BEFORE INSERT OR UPDATE ON public.ai_company_organizations
  FOR EACH ROW EXECUTE FUNCTION public.guard_ai_company_feature_flag();

DROP TRIGGER IF EXISTS guard_ai_data_project_feature_flag ON public.ai_data_projects;
CREATE TRIGGER guard_ai_data_project_feature_flag
  BEFORE INSERT OR UPDATE ON public.ai_data_projects
  FOR EACH ROW EXECUTE FUNCTION public.guard_ai_company_feature_flag();

