-- Structural/privilege smoke tests for the Zurify 2.0 security migrations.
-- These checks run only against the disposable local Supabase database in CI.
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;
SELECT plan(16);

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

SELECT * FROM finish();
ROLLBACK;
