-- Super-admin-only runtime configuration for safe theme, feature and provider
-- selection. This stores no credentials. Selecting a provider does NOT enable
-- transactions; payment integration and sandbox acceptance tests remain separate.

CREATE TABLE IF NOT EXISTS public.platform_configuration (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  theme_palette text NOT NULL DEFAULT 'blue-sky-violet'
    CHECK (theme_palette IN ('blue-sky-violet', 'blue-sky-indigo', 'blue-sky-cyan')),
  payment_provider text NOT NULL DEFAULT 'disabled'
    CHECK (payment_provider IN ('disabled', 'flutterwave', 'paystack')),
  payments_enabled boolean NOT NULL DEFAULT false CHECK (payments_enabled = false),
  maintenance_mode boolean NOT NULL DEFAULT false,
  feature_flags jsonb NOT NULL DEFAULT '{
    "client_drafts": true,
    "ai_company_workspace": true,
    "client_funding": false,
    "live_payments": false,
    "dataset_exports": false,
    "promo_codes": false
  }'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.platform_configuration(singleton)
VALUES (true) ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE public.platform_configuration ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_configuration FROM anon, authenticated;

DROP POLICY IF EXISTS "Super admins read platform configuration" ON public.platform_configuration;
CREATE POLICY "Super admins read platform configuration"
  ON public.platform_configuration FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins update platform configuration" ON public.platform_configuration;
CREATE POLICY "Super admins update platform configuration"
  ON public.platform_configuration FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_public_platform_configuration()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'theme_palette', theme_palette,
    'maintenance_mode', maintenance_mode,
    'feature_flags', feature_flags - 'live_payments'
  )
  FROM public.platform_configuration
  WHERE singleton = true
$$;

CREATE OR REPLACE FUNCTION public.update_platform_configuration(
  _theme_palette text,
  _payment_provider text,
  _maintenance_mode boolean,
  _feature_flags jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE allowed_keys text[] := ARRAY[
  'client_drafts', 'ai_company_workspace', 'client_funding',
  'live_payments', 'dataset_exports', 'promo_codes'
];
DECLARE flag_key text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Super-admin permission required' USING ERRCODE = '42501';
  END IF;
  IF _theme_palette NOT IN ('blue-sky-violet', 'blue-sky-indigo', 'blue-sky-cyan') THEN
    RAISE EXCEPTION 'Unsupported theme palette';
  END IF;
  IF _payment_provider NOT IN ('disabled', 'flutterwave', 'paystack') THEN
    RAISE EXCEPTION 'Unsupported payment provider';
  END IF;
  IF _feature_flags IS NULL OR jsonb_typeof(_feature_flags) <> 'object' THEN
    RAISE EXCEPTION 'Feature flags must be a JSON object';
  END IF;

  FOR flag_key IN SELECT jsonb_object_keys(_feature_flags) LOOP
    IF NOT flag_key = ANY(allowed_keys) THEN
      RAISE EXCEPTION 'Unknown feature flag: %', flag_key;
    END IF;
    IF jsonb_typeof(_feature_flags -> flag_key) <> 'boolean' THEN
      RAISE EXCEPTION 'Feature flag values must be booleans';
    END IF;
  END LOOP;

  -- This milestone deliberately keeps payment activation false even when the
  -- preferred provider is selected. A later payment release must replace this
  -- hard stop only after signed webhook and reconciliation tests pass.
  UPDATE public.platform_configuration
    SET theme_palette = _theme_palette,
        payment_provider = _payment_provider,
        payments_enabled = false,
        maintenance_mode = COALESCE(_maintenance_mode, false),
        feature_flags = (
          '{
            "client_drafts": true,
            "ai_company_workspace": true,
            "client_funding": false,
            "live_payments": false,
            "dataset_exports": false,
            "promo_codes": false
          }'::jsonb || _feature_flags
        ) || '{"client_funding": false, "live_payments": false, "dataset_exports": false, "promo_codes": false}'::jsonb,
        updated_by = auth.uid(),
        updated_at = now()
    WHERE singleton = true;

  INSERT INTO public.audit_logs(actor_id, action, target_type, target_id, meta)
  VALUES (
    auth.uid(), 'update_platform_configuration', 'platform_configuration', NULL,
    jsonb_build_object(
      'theme_palette', _theme_palette,
      'payment_provider', _payment_provider,
      'maintenance_mode', COALESCE(_maintenance_mode, false),
      'payment_activation_blocked', true,
      'feature_flag_keys', (SELECT jsonb_agg(key ORDER BY key) FROM jsonb_object_keys(_feature_flags) AS f(key))
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_platform_configuration() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_platform_configuration() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_platform_configuration()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Super-admin permission required' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT jsonb_build_object(
      'theme_palette', theme_palette,
      'payment_provider', payment_provider,
      'payments_enabled', payments_enabled,
      'maintenance_mode', maintenance_mode,
      'feature_flags', feature_flags,
      'updated_at', updated_at
    )
    FROM public.platform_configuration
    WHERE singleton = true
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_platform_configuration() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_platform_configuration() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_platform_configuration(text,text,boolean,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_platform_configuration(text,text,boolean,jsonb) TO authenticated;
