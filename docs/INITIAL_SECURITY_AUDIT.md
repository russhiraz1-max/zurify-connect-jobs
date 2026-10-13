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
- A subsequent CI run completed the production build successfully after using `npm install`; this confirms the code compiled in that runner, not that auth/payment flows work end-to-end.
- CI was then strengthened to regenerate the lockfile inside its isolated runner, run `npm ci`, and build. That latest workflow run is still awaiting a result.
- The regenerated lockfile has not yet been committed to the repository; clean install from the committed lockfile remains unresolved.
- No end-to-end auth, payment, RLS or isolated database migration test has been confirmed at the time of this document.


## Source-level verification performed on the feature branch (2026-10-13)

The following issues were confirmed by reading the checked-in migration definitions. They are source-level findings only; the current deployed database has not been changed or re-tested by this source review.

### Finding A — users can update their own application review fields (high priority)
Migration `20260719080449_775e73bf-0ade-47ce-90f2-9c6d464f6d87.sql` grants table-level `UPDATE` on `public.task_applications` to `authenticated`. Its `"Staff or user update applications"` policy allows a row owner to update their own row, with no column-level restriction. The table includes `status`, `reviewer_id`, `review_notes`, `rejection_reason` and `reviewed_at`. The migration also defines privileged RPCs for staff to approve/reject applications, so the direct owner-update route can undermine that workflow if later migrations do not revoke it.

**Required remediation:** in the 2.0 schema, remove direct owner updates to protected columns. Prefer owner-only insert/cancel through guarded RPCs and staff-only review RPCs; if direct updates are required, use column-level grants and constraints/triggers that reject changes to protected review fields. Test as worker, client, staff and super-admin.

### Finding B — withdrawal request does not enforce KYC before reservation (high priority)
Migration `20260722094228_2835a738-c299-4644-bb19-3ed9a317c1b9.sql` defines `request_withdrawal` with checks for authentication, suspension/withdrawal hold, minimum amount, amount unit and available balance. It reserves funds and creates a pending request, but the function body does not check for an approved `kyc_verifications` row before reserving. The KYC table/function is introduced in migration `20260801080321_29257f3a-b974-4771-a9c4-27ceb794a1b8.sql`, later in migration order.

**Required remediation:** enforce the agreed KYC eligibility inside the atomic withdrawal-request database operation, before moving any funds. Rejections must not reserve money. Cover pending, rejected, missing and approved KYC states in isolated tests.

### Finding C — withdrawal ledger records appear to double-count the fee (high priority)
In the same withdrawal migration, `request_withdrawal` sets `net_cents = amount_cents - fee_cents` and reserves `amount_cents` from available balance. `approve_withdrawal` then writes a wallet transaction of `-amount_cents` with type `withdrawal` and an additional `-fee_cents` transaction of type `fee`, while the reserved amount was already removed from available balance at request time. Under a gross-amount interpretation, those ledger entries sum to more than the reserved gross amount by the fee. The intended meaning of gross amount and ledger transaction semantics must be confirmed before a fix is chosen.

**Required remediation:** define one unambiguous invariant for requested gross amount, fee, payout net, reserved amount and ledger entries; then test request → approval and request → rejection with synthetic wallets. Do not edit historic ledger rows or silently change the fee policy.

### Finding D — task capacity checks are not atomic in the inspected function bodies (high priority)
The inspected `apply_to_task` function counts active applications and then inserts; the inspected `submit_task` function counts per-user and total submissions and then inserts. Those count-and-insert sequences do not lock the task row or atomically reserve capacity in the inspected definitions, so simultaneous requests may both pass the count checks. A partial unique index protects one active application per user/task but does not enforce a task-wide capacity limit.

**Required remediation:** use task-row locking, an atomic capacity counter/reservation, or another transaction-safe constraint appropriate to the final schema. Add parallel-worker tests at the configured capacity boundary.

### Finding E — self-update protections for profiles still need exact current-state proof
The inspected migrations add `suspended` and `withdrawal_hold` fields and privileged admin RPCs for changing them. The source review has not yet enumerated every later policy/grant that applies to `profiles`, so this finding remains **unconfirmed in the final migration state** until all subsequent migrations and table grants are reconciled.

### Scope and safe next actions
- Do not patch historical migrations and do not apply schema changes to the existing production Supabase project.
- Inspect all later migrations and frontend callers before designing a forward-only 2.0 hardening migration.
- Run the migration chain against a fresh isolated 2.0 database with synthetic data before calling a database fix verified.
- Review every `SECURITY DEFINER` function's full body, grants, search path, caller and role gate; function-name matches or advisor counts alone are not proof of exploitability.
