-- Structural/privilege smoke tests for the Zurify 2.0 security migrations.
-- These checks run only against the disposable local Supabase database in CI.
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;
SELECT plan(53);

SELECT ok(
  to_regprocedure('public.complete_account_type(text)') IS NOT NULL,
  'restricted OAuth account-type RPC exists'
);

SELECT ok(
  to_regprocedure('public.reject_withdrawal(uuid,text,boolean)') IS NOT NULL,
  'three-argument withdrawal rejection overload exists'
);

SELECT ok(
  position('DEFAULT' in upper(pg_get_function_arguments(
    to_regprocedure('public.reject_withdrawal(uuid,text,boolean)')
  ))) = 0,
  'three-argument rejection overload has no default argument'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.complete_account_type(text)', 'EXECUTE'),
  'authenticated users can call the account-type RPC'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.complete_account_type(text)', 'EXECUTE'),
  'anonymous users cannot call the account-type RPC'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.request_withdrawal(integer,public.withdrawal_method,jsonb)', 'EXECUTE'),
  'authenticated users can call the withdrawal request RPC'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.request_withdrawal(integer,public.withdrawal_method,jsonb)', 'EXECUTE'),
  'anonymous users cannot call the withdrawal request RPC'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.create_client_task(text,text,text,integer,uuid,integer,integer)', 'EXECUTE'),
  'authenticated users can call the client draft RPC'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.create_client_task(text,text,text,integer,uuid,integer,integer)', 'EXECUTE'),
  'anonymous users cannot call the client draft RPC'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'streak_claims'
      AND t.tgname = 'guard_worker_streak_claim' AND NOT t.tgisinternal
  ),
  'streak claim role guard trigger exists'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'lucky_claims'
      AND t.tgname = 'guard_worker_lucky_claim' AND NOT t.tgisinternal
  ),
  'lucky claim role guard trigger exists'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'mystery_claims'
      AND t.tgname = 'guard_worker_mystery_claim' AND NOT t.tgisinternal
  ),
  'mystery claim role guard trigger exists'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'challenge_claims'
      AND t.tgname = 'guard_worker_challenge_claim' AND NOT t.tgisinternal
  ),
  'challenge claim role guard trigger exists'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'user_badges'
      AND t.tgname = 'guard_worker_badge_award' AND NOT t.tgisinternal
  ),
  'badge award role guard trigger exists'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.profiles'::regclass),
  'profiles table has row-level security enabled'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.task_applications'::regclass),
  'task_applications table has row-level security enabled'
);


SELECT ok(
  EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'public' AND t.typname = 'app_role' AND e.enumlabel = 'ai_company'),
  'AI company is a dedicated application role'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ai_company_organizations'::regclass),
  'AI company organizations have row-level security enabled'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ai_data_projects'::regclass),
  'AI data projects have row-level security enabled'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.create_ai_company_profile(text,text,text)', 'EXECUTE'),
  'authenticated AI-company users can invoke organization profile RPC'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.create_ai_company_profile(text,text,text)', 'EXECUTE'),
  'anonymous users cannot invoke organization profile RPC'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.create_ai_data_project(text,text,text,text,text,text,text,text,integer,boolean)', 'EXECUTE'),
  'authenticated users can invoke AI data project RPC'
);



-- Behavioral onboarding checks using synthetic auth users. This file runs only
-- against the disposable local Supabase database; the surrounding transaction
-- is rolled back at the end of the test.
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '9e21a05e-5f12-4df6-94a7-4d6fbeb30001',
  'authenticated', 'authenticated', 'zurify-oauth-test@example.invalid', '',
  now(),
  '{"provider":"google","providers":["google"]}'::jsonb,
  '{"account_type":"employer"}'::jsonb,
  now(), now()
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = '9e21a05e-5f12-4df6-94a7-4d6fbeb30001'
      AND role = 'user'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = '9e21a05e-5f12-4df6-94a7-4d6fbeb30001'
      AND role IN ('job_seeker', 'employer')
  ),
  'OAuth metadata alone cannot silently assign a worker/client role'
);

SET LOCAL request.jwt.claim.sub = '9e21a05e-5f12-4df6-94a7-4d6fbeb30001';
SET LOCAL request.jwt.claim.role = 'authenticated';

SELECT is(
  public.complete_account_type('employer'),
  'employer',
  'OAuth user can complete onboarding with the selected client role'
);

SELECT ok(
  public.has_role('9e21a05e-5f12-4df6-94a7-4d6fbeb30001', 'employer'::public.app_role),
  'onboarding assigns the selected role'
);

SELECT throws_ok(
  'SELECT public.complete_account_type(''job_seeker'')',
  '42501',
  'Account type has already been selected',
  'onboarding rejects switching from client to freelancer'
);

SELECT throws_ok(
  'SELECT public.complete_account_type(''super_admin'')',
  '22023',
  'Choose a supported account type',
  'onboarding rejects privileged or unsupported role values'
);


INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '9e21a05e-5f12-4df6-94a7-4d6fbeb30002',
  'authenticated', 'authenticated', 'zurify-ai-company-test@example.invalid', '',
  now(),
  '{"provider":"google","providers":["google"]}'::jsonb,
  '{}'::jsonb,
  now(), now()
);

SET LOCAL request.jwt.claim.sub = '9e21a05e-5f12-4df6-94a7-4d6fbeb30002';
SET LOCAL request.jwt.claim.role = 'authenticated';

SELECT is(
  public.complete_account_type('ai_company'),
  'ai_company',
  'OAuth user can choose the dedicated AI-company account type'
);

SELECT ok(
  public.has_role('9e21a05e-5f12-4df6-94a7-4d6fbeb30002', 'ai_company'::public.app_role),
  'AI-company onboarding assigns only the selected AI-company role'
);


SELECT public.create_ai_company_profile(
  'Synthetic AI Research',
  'https://example.invalid',
  'ai-team@example.invalid'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.ai_company_organizations
    WHERE owner_user_id = '9e21a05e-5f12-4df6-94a7-4d6fbeb30002'
      AND verification_status = 'pending'
  ),
  'new AI-company organization remains pending until staff verification'
);

SELECT public.create_ai_data_project(
  'Synthetic Swahili speech dataset',
  'language_culture',
  'This synthetic project collects consented Swahili speech records for evaluation.',
  'Contributors record a short phrase and confirm consent before providing each sample.',
  'Swahili',
  'Coastal Swahili',
  'sw-KE',
  'Kenya',
  25,
  true
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.ai_data_projects
    WHERE created_by = '9e21a05e-5f12-4df6-94a7-4d6fbeb30002'
      AND status = 'draft'
      AND consent_required = true
      AND expected_records = 25
  ),
  'AI-company project creation creates a consent-required draft only'
);

SELECT throws_ok(
  'SELECT public.submit_ai_project_for_review((SELECT id FROM public.ai_data_projects WHERE created_by = ''9e21a05e-5f12-4df6-94a7-4d6fbeb30002'' ORDER BY created_at DESC LIMIT 1))',
  'P0001',
  'Organization verification is required before project review',
  'AI-company project cannot be submitted before organization verification'
);


SELECT ok(
  NOT has_table_privilege('authenticated', 'public.platform_configuration', 'SELECT'),
  'authenticated users cannot bypass the configuration read RPC'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.platform_configuration', 'UPDATE'),
  'authenticated users cannot bypass the audited configuration update RPC'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.get_admin_platform_configuration()', 'EXECUTE'),
  'authenticated users can call the guarded admin configuration read RPC'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.get_admin_platform_configuration()', 'EXECUTE'),
  'anonymous users cannot call the admin configuration read RPC'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'tasks'
      AND t.tgname = 'guard_client_draft_feature_flag' AND NOT t.tgisinternal
  ),
  'client draft feature flag is enforced by a database trigger'
);

SELECT is(
  public.is_platform_feature_enabled('client_drafts'),
  true,
  'enabled client draft flag is read by the database guard'
);

SELECT is(
  public.is_platform_feature_enabled('live_payments'),
  false,
  'live payments remain disabled in the platform configuration'
);


SELECT throws_ok(
  'SELECT public.get_admin_platform_configuration()',
  '42501',
  'Super-admin permission required',
  'AI-company account cannot read the locked admin configuration'
);

SELECT throws_ok(
  'SELECT public.update_platform_configuration(''blue-sky-violet'',''disabled'',false,''{}''::jsonb)',
  '42501',
  'Super-admin permission required',
  'AI-company account cannot change locked platform configuration'
);


INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '9e21a05e-5f12-4df6-94a7-4d6fbeb30003',
  'authenticated', 'authenticated', 'zurify-staff-test@example.invalid', '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"account_type":"job_seeker"}'::jsonb,
  now(), now()
);
INSERT INTO public.user_roles(user_id, role)
VALUES ('9e21a05e-5f12-4df6-94a7-4d6fbeb30003', 'staff')
ON CONFLICT (user_id, role) DO NOTHING;

SET LOCAL request.jwt.claim.sub = '9e21a05e-5f12-4df6-94a7-4d6fbeb30003';
SET LOCAL request.jwt.claim.role = 'authenticated';

SELECT throws_ok(
  'SELECT public.review_ai_company(''9e21a05e-5f12-4df6-94a7-4d6fbeb39999''::uuid, ''approved'', NULL)',
  '42501',
  'AI-company review permission required',
  'staff without the AI-company permission cannot approve organizations'
);

SELECT throws_ok(
  'SELECT public.review_ai_data_project(''9e21a05e-5f12-4df6-94a7-4d6fbeb39999''::uuid, ''approved'', NULL)',
  '42501',
  'AI-project review permission required',
  'staff without the AI-project permission cannot approve data projects'
);


SELECT ok(
  has_function_privilege('anon', 'public.get_public_platform_configuration()', 'EXECUTE'),
  'anonymous users can read the safe public theme and maintenance configuration'
);


INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '9e21a05e-5f12-4df6-94a7-4d6fbeb30004',
  'authenticated', 'authenticated', 'zurify-superadmin-test@example.invalid', '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"account_type":"job_seeker"}'::jsonb,
  now(), now()
);
INSERT INTO public.user_roles(user_id, role)
VALUES ('9e21a05e-5f12-4df6-94a7-4d6fbeb30004', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;

SET LOCAL request.jwt.claim.sub = '9e21a05e-5f12-4df6-94a7-4d6fbeb30004';
SET LOCAL request.jwt.claim.role = 'authenticated';

SELECT public.update_platform_configuration(
  'blue-sky-indigo',
  'flutterwave',
  false,
  '{"client_drafts":false,"ai_company_workspace":false,"client_funding":true,"live_payments":true,"dataset_exports":true,"promo_codes":true}'::jsonb
);

SELECT is(
  (SELECT feature_flags ->> 'client_drafts' FROM public.platform_configuration WHERE singleton = true),
  'false',
  'super admin can disable client draft creation'
);

SELECT is(
  (SELECT feature_flags ->> 'ai_company_workspace' FROM public.platform_configuration WHERE singleton = true),
  'false',
  'super admin can disable the AI-company workspace'
);

SELECT is(
  (SELECT feature_flags ->> 'client_funding' FROM public.platform_configuration WHERE singleton = true),
  'false',
  'client funding remains locked even if a caller requests it enabled'
);

SELECT is(
  (SELECT feature_flags ->> 'live_payments' FROM public.platform_configuration WHERE singleton = true),
  'false',
  'live payments remain locked even if a caller requests them enabled'
);

SELECT is(
  (SELECT feature_flags ->> 'dataset_exports' FROM public.platform_configuration WHERE singleton = true),
  'false',
  'dataset exports remain locked until implemented'
);

SELECT is(
  (SELECT feature_flags ->> 'promo_codes' FROM public.platform_configuration WHERE singleton = true),
  'false',
  'promo codes remain locked until implemented'
);

SELECT is(
  (SELECT payments_enabled FROM public.platform_configuration WHERE singleton = true),
  false,
  'provider selection cannot activate real payment processing'
);

-- Verify that feature flags stop real writes at the database boundary, not
-- merely in the control-center UI. The test account is synthetic and this
-- entire test transaction rolls back.
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '9e21a05e-5f12-4df6-94a7-4d6fbeb30005',
  'authenticated', 'authenticated', 'zurify-client-flag-test@example.invalid', '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"account_type":"employer"}'::jsonb,
  now(), now()
);

SET LOCAL request.jwt.claim.sub = '9e21a05e-5f12-4df6-94a7-4d6fbeb30005';
SET LOCAL request.jwt.claim.role = 'authenticated';

SELECT throws_ok(
  'SELECT public.create_client_task(''Flag disabled draft'', ''This synthetic description is long enough for validation.'', ''Instructions for this synthetic draft.'', 100, NULL, 10, 10)',
  '42501',
  'Client draft creation is temporarily disabled',
  'disabled client-draft flag blocks draft creation in the database'
);

SET LOCAL request.jwt.claim.sub = '9e21a05e-5f12-4df6-94a7-4d6fbeb30002';
SET LOCAL request.jwt.claim.role = 'authenticated';

SELECT throws_ok(
  'SELECT public.create_ai_data_project(''Flag disabled AI project'', ''language_culture'', ''This synthetic project description is long enough for validation.'', ''These synthetic instructions require contributor consent and a quality review.'', ''Swahili'', ''Coastal Swahili'', ''sw-KE'', ''Kenya'', 25, true)',
  '42501',
  'AI-company workspace is temporarily disabled',
  'disabled AI-company flag blocks project writes in the database'
);

SELECT * FROM finish();
ROLLBACK;
