# Initial Security and Build Audit — Zurify 2.0

Date: 2026-10-13
Scope: source repository review and previously observed schema/advisor findings. This is a working audit, not a claim that every issue has been re-tested against a clean isolated 2.0 database.

## Critical guardrails
- Keep production database, user data, wallet/ledger, KYC, tasks, submissions and withdrawals unchanged.
- All fixes to schema/security behavior must be tested in the dedicated 2.0 database first.
- Treat this as a finding list; confirm current function signatures, grants, dependencies and callers before changing or dropping anything.

## Confirmed in this session
1. The tracked `.env` file was empty at the checked branch tip. It has been removed from the feature branch, `.env` and `.env.*` are ignored, and `.env.example` contains placeholders only. This does not prove historical Git commits never contained secrets; history scanning and credential rotation are separate checks.
2. `package.json` and `package-lock.json` are out of sync. GitHub Actions `npm ci` failed before compilation due version mismatches and missing lockfile entries, including the Lovable Vite config and QR-code dependencies. A clean lockfile regeneration and a successful build are still required.
3. Auth route currently returns a user to `/` after email confirmation/OAuth; authenticated sessions landing on `/` or `/auth` are now redirected toward `/dashboard`. This change has not yet passed an end-to-end auth test.
4. Signup currently may run with email confirmation enabled; a null session must not be treated as a completed signed-in session. Referral-code application is currently attempted only when a session exists, so the confirmed-email path still needs a safe way to apply a referral code after authentication if that behavior is required.
5. Current auth page uses the Lovable OAuth helper. Do not remove the package until its token/session exchange responsibilities have a tested replacement.

## High-priority database/application findings to verify and fix
- Profile self-update permissions/policies were previously observed as potentially allowing users to update sensitive `suspended` and `withdrawal_hold` fields. Recheck table grants, RLS and policies, then move privileged field changes to a role-checked server/database operation.
- Task application self-update permissions/policies were previously observed as potentially allowing changes to protected fields such as status, reviewer identity or review notes. Recheck and restrict user-writable columns.
- `admin_analytics_series(_days integer)` was previously identified as SECURITY DEFINER without an evident role gate. Confirm the exact current definition and all grants, then require explicit authorized staff/admin access or remove unnecessary exposure.
- `get_user_reputation(_user_id uuid)` and `challenge_progress(_user_id uuid, _c challenges)` were previously identified as SECURITY DEFINER functions accepting arbitrary user IDs. Confirm whether they expose private user metrics and require self-or-authorized-staff access.
- Role helper functions with caller-supplied user IDs require dependency-aware review. Never blanket-revoke or alter SECURITY DEFINER helper grants without inspecting every policy/function dependency.
- Frontend authorization has treated legacy `admin` as staff/super-admin-like, while SQL role helpers have historically recognized a narrower set. Align a documented role matrix across routes, RPCs and RLS.
- A legacy `reject_withdrawal` overload was previously observed that can mark a withdrawal rejected without releasing reserved funds, while another overload includes reservation-release behavior. Confirm current signatures and callers; remove/restrict the unsafe overload only after dependency checks.
- Withdrawal request flow was previously observed reserving funds before KYC approval is checked later. Decide and enforce the intended KYC gate consistently, and prove every reject/cancel/failure path releases reserved funds exactly once.
- Task application/submission capacity checks were previously observed without row-level locking/atomic reservation. Add concurrency-safe database operations and parallel-worker tests.
- Preserve the duplicate-processing guard in submission approval; ledger credit must be exactly-once.
- KYC and submission-proof buckets were previously configured private, but end-to-end access-path testing was incomplete. Verify access as owner, other user, staff and admin.
- Previously observed Supabase advisor counts included SECURITY DEFINER function grants, RLS init-plan warnings, unindexed foreign keys, overlapping permissive policies and unused indexes. Counts alone do not prove exploitability; triage each with source, call graph and test evidence.
- Breached-password protection was previously reported disabled. Enable it in the new Supabase auth configuration and test signup/reset behavior.

## Money/accounting constraints
- Wallet balances and ledger values are integer cents.
- External gateway transaction state is not a substitute for the internal ledger.
- Use idempotency keys/unique provider references and transactional database functions for credits, refunds and withdrawals.
- Never change historical ledger records to make a new fee policy appear retroactive.
- Prior observations found a difference between a withdrawal's gross, fee and net accounting; reproduce it with synthetic accounts and reconcile every ledger row before changing calculations.
- Confirm the intended withdrawal-fee policy with the founder before implementing a new rate. Do not silently assume a rate.

## Current CI state
- First `npm ci` attempt failed before the app build because package manifest and lockfile were inconsistent.
- CI was changed to use `npm install` for the next verification attempt; this is a temporary diagnostic workaround, not a completed lockfile repair.
- No successful production build or end-to-end test has been confirmed at the time of this document.
