-- Structural/privilege smoke tests for the Zurify 2.0 security migrations.
-- These checks run only against the disposable local Supabase database in CI.
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;
SELECT plan(38);

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

SELECT * FROM finish();
ROLLBACK;
