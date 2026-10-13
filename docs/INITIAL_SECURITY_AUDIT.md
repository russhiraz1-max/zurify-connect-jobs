# Initial Security and Build Audit — Zurify 2.0

Date: 2026-10-13
Scope: source repository review and previously observed schema/advisor findings. This is a working audit, not a claim that every issue has been re-tested against a clean isolated 2.0 database.

## Critical guardrails
- Keep production database, user data, wallet/ledger, KYC, tasks, submissions and withdrawals unchanged.
- All fixes to schema/security behavior must be tested in the dedicated 2.0 database first.
- Treat this as a finding list; confirm current function signatures, grants, dependencies and callers before changing or dropping anything.

## Confirmed in this session
1. The tracked `.env` file was empty at the checked branch tip. It has been removed from the feature branch, `.env` and `.env.*` are ignored, and `.env.example` contains placeholders only. This does not prove historical Git commits never contained secrets; history scanning and credential rotation are separate checks.
2. `package.json` and `package-lock.json` remain out of sync. The current GitHub Actions workflow temporarily regenerates the lockfile in its isolated runner, then `npm ci` and `npm run build` pass (latest verified run #256, head `957da0d9cab483f0850d64c883e4ba245faeb0da`). This is evidence that CI can install/build from the manifest, not that the committed lockfile is reproducible; a synchronized lockfile still needs to be regenerated and committed.
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


## Additional migration-chain findings (review expanded to all 20 checked-in migrations)

### Finding F — profile owner-update policy remains a high-risk permission to resolve
The initial migration `20260717124948_41ff06d2-b465-4761-b91f-151978d71498.sql` grants `SELECT, INSERT, UPDATE` on `public.profiles` to `authenticated` and creates `"Users update own profile"` with `USING (auth.uid() = id)`. A later migration adds `suspended` and `withdrawal_hold` fields. A later migration changes profile SELECT visibility, but the checked-in migration chain reviewed so far does not show a corresponding column-restricted UPDATE grant or owner-update policy replacement. Direct owner updates to privileged profile fields are a serious risk until the final effective grants/policies are verified on a fresh database.

**Remediation:** restrict owner updates to an explicit allowlist of safe profile columns; make suspension and withdrawal holds writable only through audited privileged RPCs. Test direct REST/PostgREST updates as a normal authenticated user.

### Finding G — SECURITY DEFINER user metrics functions accept caller-supplied user IDs
Migration `20260805005823_261146a7-0269-4692-b574-1ce0f5a75adb.sql` defines `get_user_reputation(_user_id uuid)` and `challenge_progress(_user_id uuid, _c public.challenges)` as SECURITY DEFINER functions and grants execution to authenticated users. Their bodies query submissions, KYC state, profile suspension/holds, wallet transactions, and referral activity for the supplied ID. The definitions inspected do not first require `_user_id = auth.uid()` or a staff permission. Confirm whether the returned metrics are intended to be public; otherwise enforce self-only access or a deliberately public, privacy-reviewed projection.

### Finding H — legacy role semantics need a single documented policy
The role helper migration defines `is_super_admin` using only `super_admin`, while `is_staff` recognizes `staff` and `super_admin`. Some later administrative listing logic treats legacy `admin` as super-admin-like, but that does not make `is_super_admin` return true for that role. This is an inconsistency, not proof that every route is exploitable. Establish the intended 2.0 role matrix and use it consistently in UI, SQL policies, RPCs and tests.

### Findings not automatically classified as vulnerabilities
- `application_settings` has a table-level UPDATE grant, but the inspected RLS policy explicitly requires `is_super_admin(auth.uid())` in both USING and WITH CHECK; do not report the grant alone as an authorization bypass.
- `has_role`, `is_staff` and `is_super_admin` are executable by anon/authenticated in the inspected role-helper migration and return booleans. Execution grants alone do not prove a data leak; review their use and disclosure implications in context.
- The KYC storage policy explicitly names owner/reviewer access in the inspected migration, but end-to-end storage path tests remain outstanding.

### Scope of this review
The checked-in migration directory contained 20 SQL migrations. Source-level review was expanded across the migration chain for profile grants/policies, application permissions, withdrawal logic, task capacity checks, role helpers and selected user-metrics functions. This is not equivalent to inspecting the effective catalog of a deployed database, and no SQL was executed against production or an isolated Supabase project.


## Remediation code drafted on the feature branch

Migration `supabase/migrations/20261013120000_zurify_2_0_column_level_privileges.sql` now narrows direct authenticated-client writes:
- Removes table-level INSERT/UPDATE on `profiles` and grants UPDATE only on `full_name, headline, bio, location, website`.
- Removes table-level UPDATE on `task_applications` and grants UPDATE only on `note, cover_letter, experience, cv_path`.
- Leaves row-level security in place and expects privileged state changes to use existing SECURITY DEFINER RPCs.

**Status: implemented in source, not yet executed or validated.** Before treating this as a fix, apply the full migration chain to a disposable Supabase database and test signup/profile editing, application editing/cancellation/review, and direct attempts to change `suspended`, `withdrawal_hold`, `status`, `reviewer_id`, `review_notes`, and `rejection_reason`. Confirm no client flow depends on direct inserts/updates outside the allowed columns. Do not apply to production.


## Additional finding and remediation drafted — analytics RPC authorization

The source review confirmed that `admin_analytics_series(integer)` was a SECURITY DEFINER SQL function granted to authenticated users, and unlike `admin_analytics_overview()`, the inspected function body had no staff-role check. Its result includes daily signup, completed-task, referral, fee, expense, profit, withdrawal-count and payout aggregates. This is a confirmed authorization gap in the checked-in migration source for any signed-in account able to invoke the RPC; deployed exploitability still depends on the effective deployed grants/function definition.

A new migration `20261013123000_secure_analytics_and_internal_metrics.sql` replaces the function with a `public.is_staff(auth.uid())` check and bounds the requested window to 1–365 days. It also revokes direct API-role execution of `get_user_reputation(uuid)` and `challenge_progress(uuid, public.challenges)`, which the checked-in source calls internally from protected SECURITY DEFINER RPCs.

**Status:** source code drafted, not executed. Verify staff and non-staff behavior in an isolated database, verify protected parent RPCs still work, and confirm all intended clients use the parent RPCs rather than calling the helpers directly. No production database was changed.


## Additional remediation migrations drafted on the feature branch (2026-10-13)

### Withdrawal KYC gate and legacy rejection RPC
Migration `20261013130000_enforce_withdrawal_kyc_and_release_reserves.sql` now requires an approved KYC record before `request_withdrawal` reserves any funds. It also replaces the legacy two-argument `reject_withdrawal(uuid,text)` with a wrapper to the existing authorized three-argument implementation, which locks the request and releases the reserve. This prevents old callers from reaching the older rejection implementation that did not release reserved funds.

### Task-capacity serialization
Migration `20261013133000_serialize_task_capacity_checks.sql` replaces `apply_to_task` and `submit_task` to lock the parent task row while checking and inserting applications/submissions. This serializes concurrent requests for the same task so capacity counts are rechecked after waiting. It does not substitute for running concurrency tests.

### Withdrawal ledger fee accounting
Migration `20261013140000_correct_withdrawal_ledger_entries.sql` preserves the current approval function's KYC, reserve, referral and pending-status guards, but records the withdrawal transaction as `-net_cents` and the service fee separately as `-fee_cents`. Those two entries now sum to the gross reserved amount (`amount_cents`) rather than recording gross plus fee. This applies to future approvals only; it does not rewrite historic ledger rows.

**All three migrations are source changes only.** They have not been applied to a database. Verify them by applying the full chain to a fresh disposable Supabase project, then test KYC-pending/rejected/approved withdrawals, legacy and current rejection RPC calls, concurrent application/submission requests, and ledger invariants. Confirm the intended definition of lifetime-withdrawn reporting before changing that counter.

## Account-type assignment safety review
Migration `20261013150000_add_safe_signup_account_types.sql` replaces the new-user trigger to preserve profile/wallet creation and the configured super-admin bootstrap while assigning only one of two allowed non-privileged roles from user-editable metadata: `job_seeker` or `employer`. Unknown/missing values fall back to `job_seeker`. The trigger also retains the baseline `user` role. This is not sufficient by itself to implement client posting: task ownership, client policies, role-specific routes, OAuth onboarding, and the effective enum/catalog must still be tested in an isolated database.

## Client task draft boundary
Migration `20261013160000_add_employer_draft_task_creation.sql` adds an employer-owned-task SELECT policy and a server-side `create_client_task` RPC. It checks authentication, role, suspension, bounded inputs, and optional category existence, then always inserts a draft with no featured/priority privilege. It does not add a client publish/update policy. Source review only; isolated database tests must confirm the function and policy compile and that existing admin task workflows remain intact.


## Follow-up source audit — withdrawal rejection reserve integrity

**Source evidence:** the historical two-argument `reject_withdrawal(uuid,text)` marks a pending request rejected and records notifications/audit data, but does not release `wallets.pending_withdrawal_cents` back to `available_cents`. A later three-argument overload attempts release using `GREATEST` and `LEAST`, which can conceal a reserve mismatch by releasing less than the requested amount instead of failing for reconciliation.

**Branch remediation:** `20261013130000_enforce_withdrawal_kyc_and_release_reserves.sql` routes the legacy two-argument RPC to the three-argument implementation. `20261013170000_enforce_exact_withdrawal_reserve_release.sql` now adds an explicit reserve-exists check and releases the exact reserved amount atomically; a mismatch raises an error rather than silently under-releasing.

**Validation status:** source-only. Neither migration has been executed against a database. Before this is marked verified, test pending/rejected/approved status transitions, duplicate rejection, insufficient/mismatched reserve, staff permission denial, optional withdrawal hold, notification/audit records, and rollback atomicity on a disposable 2.0 database. Never replay this as a production repair without a separately reviewed migration and reconciliation plan.


## Follow-up source audit — legacy admin role semantics

The checked-in frontend role helper previously treated both `admin` and `super_admin` as super-admin, granting the `admin` role all frontend permission checks. The database helper `is_super_admin(uuid)` recognizes only `super_admin`, while database `is_staff(uuid)` recognizes `staff` and `super_admin` but not `admin`. The admin route itself separately accepts `admin`, `staff`, `super_admin`, or users with permissions. These differences can produce misleading UI access and inconsistent authorization behavior.

**Branch remediation:** the frontend now reserves the `isSuperAdmin` flag for the actual `super_admin` role; legacy `admin` still receives staff-shell navigation but no longer automatically bypasses permission checks in the UI.

**Remaining work:** do not assume the role model is fully aligned. Decide the intended least-privilege capability set for legacy `admin`, reconcile SQL helpers and admin route guards, then test direct table/RPC calls as `admin`, `staff`, and `super_admin` in an isolated database.


## Follow-up onboarding audit — Google OAuth account-type intent

The email/password signup form submits `account_type` metadata, and the signup trigger safely maps only `employer` or the default `job_seeker`. The Google OAuth button, however, calls the Lovable OAuth wrapper without persisting the selected signup intent. The wrapper's options support a redirect URI and provider `extraParams`, not Supabase user metadata. Therefore a person who chooses “Hire talent” and then continues with Google may still be assigned the default worker role.

**Status:** identified; not patched in this step because passing arbitrary provider parameters is not a reliable or safe way to assign application roles.

**Required solution:** implement an explicit post-OAuth onboarding step or a narrowly scoped authenticated RPC that can assign only non-privileged account types, then test new OAuth signups, existing OAuth sign-ins, retries, and role switching. Never allow client-controlled metadata or OAuth query parameters to assign staff/admin roles.


## Follow-up task-action audit — profile existence and suspension race

The capacity-serialization migration now locks the caller's profile row before checking suspension in both `apply_to_task` and `submit_task`. It also rejects the operation if the profile row is missing. This closes a source-level gap where a missing profile could leave a NULL suspension value and let the operation continue, and serializes task actions against concurrent profile suspension updates.

**Validation status:** source-only. The migration has not been applied to a database. Test profile deletion/missing-profile behavior, concurrent suspension and task actions, transaction rollback, and application/submission capacity under concurrent requests on a disposable database.


## Follow-up wallet audit — withdrawal reserve events are missing from transaction history

The inspected `request_withdrawal` function immediately decreases `wallets.available_cents` and increases `pending_withdrawal_cents`, but does not insert a corresponding `wallet_transactions` row. The rejection path restores the reserve to available balance without inserting a release row. The approval path inserts negative payout/fee rows only after the request was already reserved. The wallet page reads `wallet_transactions` as its recent transaction history and displays each row's `balance_after_cents`.

This means the displayed transaction history does not represent every balance transition: the reserve and release are invisible, while approval history appears later and its balance-after field reflects the already-reserved available balance. The existing transaction table may be functioning as a partial earnings/payout history rather than a complete authoritative ledger.

**Status:** identified; not silently patched because adding reserve/release rows without defining available-vs-reserved semantics could double-count withdrawals.

**Required design:** decide whether to upgrade the current transaction table or introduce a balanced, append-only ledger with distinct available, reserved, payout and fee movements. Specify idempotency keys and a reconciliation equation for each withdrawal lifecycle. Test request, approval, rejection, retries, concurrent requests and historical records in an isolated database. Do not rewrite historical production transactions without a reviewed migration plan.


## OAuth account-type RPC gap — source implementation added

The account selection route calls `public.complete_account_type(text)`. The frontend route and root redirect existed, but the matching migration was absent from the reviewed migration set. Added `20261013180000_safe_oauth_account_type_onboarding.sql` on the feature branch.

The function:
- accepts only `job_seeker` or `employer`;
- requires an authenticated caller and an existing profile;
- locks that profile row to serialize concurrent first-time choices;
- denies accounts carrying privileged/special roles;
- rejects switching between the two account types after one has been assigned;
- permits a repeat call for the same account type; and
- revokes execution from PUBLIC/anon and grants it to authenticated.

**Status:** source implementation only. The successful frontend build cannot prove the migration runs or the function is secure against the actual deployed schema. Required tests: apply the complete migration chain to a disposable Supabase database, test all accepted/rejected role values, existing-account retries, concurrent conflicting selections, missing profile, OAuth callback/reload and role queries under RLS.


### Follow-up: align auth trigger with the post-OAuth chooser

A follow-up review found a mismatch: the account-role trigger previously defaulted every new account with missing/unknown `account_type` metadata to `job_seeker`. That could prevent a Google OAuth account without an explicit choice from reaching `/choose-account-type`, because the root redirect sees an existing application role.

Updated `20261013150000_add_safe_signup_account_types.sql` so only the email/password provider consumes the allowlisted `account_type` metadata and defaults to `job_seeker` when that metadata is absent/invalid. OAuth and unknown/missing-provider accounts receive only the baseline `user` role and must use the authenticated chooser, even if user metadata contains an `account_type` value.

**Status:** source-level correction, not DB-tested. Verify actual `raw_app_meta_data.provider` values for email and Google in a disposable Supabase project, plus OAuth callback/reload and email confirmation flows. If provider metadata differs in the target Supabase setup, update the condition before rollout.


## Admin shell access guard

The shared `AdminShell` previously rendered its navigation and child content without waiting for or enforcing a staff-role check. Added a client-side guard that waits for `useRoles()` to resolve, renders no admin children for non-staff accounts, and redirects them to the normal dashboard. This is defense in depth only: table RLS, route/server authorization and protected RPC checks must remain authoritative, and each sensitive RPC must independently verify its caller.

**Status:** frontend source change; requires a successful build and role-based route tests. Verify that ordinary users and advertisers cannot see admin content, staff can see only permission-allowed tools, and super-admin retains the full console. Do not treat this UI guard as a substitute for database authorization.


## Withdrawal rejection RPC overload ambiguity

Source review found both `reject_withdrawal(uuid,text)` and `reject_withdrawal(uuid,text,boolean DEFAULT false)`. The admin UI calls the three-argument overload; older clients may call the two-argument overload. Keeping a default on the third argument overlaps those signatures and can make PostgREST RPC resolution ambiguous.

Updated `20261013170000_enforce_exact_withdrawal_reserve_release.sql` to require the third argument explicitly on the three-argument function. The two-argument wrapper delegates with `false`, while the current admin UI passes the boolean explicitly.

**Status:** source-level fix only. On a disposable Supabase database, apply migrations in order and verify PostgREST can resolve both argument shapes, then test that each path authorizes staff, changes a pending request once, releases exactly the matching reserve, and rejects retries or reserve mismatches atomically.


## Task execution role isolation

The capacity-serialization migration also contains the authoritative `apply_to_task` and `submit_task` RPCs. Source review found that the functions checked authentication and suspension but did not require a freelancer role, allowing a client-role account to attempt worker actions by calling the RPC directly rather than using the UI.

Updated both RPCs to require `job_seeker` and reject employer, staff, super-admin, legacy admin and advertiser roles. To avoid locking out existing ordinary accounts represented only by the legacy `user` role, `20261013150000_add_safe_signup_account_types.sql` now backfills `job_seeker` only for user-only accounts that do not already have a worker/client/special role.

**Status:** source-level change only. Test the full ordered migration chain in an isolated database. Verify legacy ordinary users retain work access; employer/staff/advertiser/super-admin/admin accounts cannot apply or submit even through direct RPC calls; un-onboarded OAuth accounts cannot act as workers; and the role backfill does not add worker access to accounts with other roles.


## Follow-up: close worker RPC role-check gap in source

A re-review of `20261013133000_serialize_task_capacity_checks.sql` showed that `apply_to_task` already required a freelancer role, but `submit_task` did not apply the same boundary. Added the same fail-closed role check to `submit_task`. Also added the worker-role boundary to `request_withdrawal`, so a client or un-onboarded account cannot use a direct RPC call to submit work or reserve a payout simply because it has an authenticated session, a wallet row or KYC data.

These checks require `job_seeker` and reject employer, staff, super-admin, legacy admin and advertiser roles. Mixed worker/client accounts also fail closed until reconciled. The ordinary-user backfill is in `20261013150000_add_safe_signup_account_types.sql`.

**Status:** source-only; latest CI must pass, and the full ordered migration chain plus direct-RPC tests still need to run in a disposable Supabase project. No production database was changed.


### Withdrawal reserve reconciliation strengthened

The exact-release rejection migration now compares `wallets.pending_withdrawal_cents` with the sum of all pending `withdrawal_requests.amount_cents` for that user before releasing a single request. The earlier aggregate check only ensured the wallet held at least the current request amount, which could still hide a mismatch if several requests were pending. A mismatch now aborts the rejection transaction for manual reconciliation rather than guessing.

**Status:** source-only. The invariant assumes every pending withdrawal is represented in `withdrawal_requests` and the wallet aggregate tracks the same gross amounts. Validate against a disposable database with synthetic pending requests, concurrent request/reject operations, and legacy inconsistent rows before any production use.


### Withdrawal fee configuration and arithmetic guard

The withdrawal request RPC now rejects invalid fee settings (NULL, negative, or greater than 10,000 basis points), computes intermediate fee arithmetic as numeric rather than overflowing 32-bit integer multiplication, and rejects configurations that produce a zero/negative net payout. This does not choose the business fee rate; it only bounds invalid configurations.

**Status:** source-only. Test fee rates and large cent values in a disposable database, and confirm that the intended configured fee policy matches the founder-approved policy before enabling live withdrawals.


### Approval path now checks the same reserve invariant

The withdrawal approval RPC previously checked only that the wallet aggregate was at least the current request amount. The source migration now checks that the aggregate pending reserve equals the sum of all pending withdrawal requests before approving a payout, and that gross amount equals positive net payout plus a non-negative fee. Referral commission multiplication now uses numeric arithmetic to avoid integer overflow. This complements the rejection-path reconciliation check.

**Status:** source-only. Validate approval/rejection races, old inconsistent requests, referral calculations and full transaction rollback in a disposable Supabase database. This is not a complete authoritative ledger: reserve/release movements still are not fully represented in the current wallet history.


### Engagement reward role isolation

Source review found that engagement claim functions such as daily streak, lucky reward, mystery box, challenge claim and badge sync are SECURITY DEFINER functions and did not consistently enforce the freelancer account type. The internal credit helper already revokes direct execute from authenticated clients, but client-only accounts could still attempt the parent claim RPCs. Added a database trigger guard on streak, lucky, mystery, challenge and badge claim rows. For authenticated API requests it requires the caller to own the row, have a freelancer-only role, and not be suspended; anon writes are rejected. Trusted server/migration contexts remain available for controlled maintenance.

**Status:** source-only. Test every claim RPC and direct table write with freelancer, client, mixed-role, staff, super-admin, advertiser, suspended and service-role identities. This does not replace a full review of every SECURITY DEFINER function.


## Legacy user-only accounts and worker-role continuity

The worker-only guards added to `apply_to_task`, `submit_task`, `request_withdrawal`, and engagement rewards intentionally deny accounts without a `job_seeker` role. A source review then found that the safe signup migration replaced the new-user trigger but did not backfill existing baseline-only `user` accounts, so older accounts could lose worker access after the role boundary tightened.

Added an idempotent, narrowly scoped backfill to `20261013150000_add_safe_signup_account_types.sql`: it adds `job_seeker` only when an account already has the baseline `user` role and has none of `job_seeker`, `employer`, `staff`, `admin`, `super_admin`, or `advertiser`. It does not infer client intent or overwrite existing roles.

**Status:** source-only; not run against any database. Test worker-only accounts, existing client/staff/super-admin/advertiser accounts, roleless accounts, reruns, and conflict handling on a disposable database before any rollout.
