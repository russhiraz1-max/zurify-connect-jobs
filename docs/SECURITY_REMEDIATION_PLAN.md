# Zurify 2.0 — Security Remediation Plan

Date: 2026-10-13
Status: design and source verification in progress; no database changes applied.

## Rules
- Do not change production Supabase, existing balances, ledger entries, identity records or withdrawals.
- Do not rewrite historical migrations. Create forward-only changes for the isolated 2.0 schema after reconciling the complete migration chain.
- No real gateway credentials in source control, browser code or chat.
- A finding is not closed until a fix is tested on a fresh isolated database with synthetic accounts and the test evidence is recorded.

## Prioritized work

### S1. Lock down task application mutation
Source evidence: `20260719080449_775e73bf-0ade-47ce-90f2-9c6d464f6d87.sql` grants `UPDATE` on `task_applications` to authenticated and allows owners through an UPDATE policy. The row contains staff review/status fields.
- Remove worker direct mutation of review/status fields.
- Route cancel/review through narrowly authorized RPCs.
- Add authorization tests for owner, other worker, client, staff and super-admin.
- Verify all later migrations and frontend callers before choosing grants/policies.

### S2. Make withdrawal eligibility and ledger accounting consistent
Source evidence: `20260722094228_2835a738-c299-4644-bb19-3ed9a317c1b9.sql` defines a withdrawal request that reserves funds without checking approved KYC in the function body; its approval path records a gross withdrawal transaction and a separate fee transaction.
- Confirm policy: KYC must be approved before reservation/payout.
- Specify invariant: available + reserved balances, requested gross, fee, net payout, and ledger totals.
- Enforce eligibility and reservation atomically.
- Make rejection release exactly the reserved amount and fail closed on reserve mismatch.
- Test approved/rejected/pending KYC, concurrent requests, duplicate approval/rejection, and all ledger invariants.

### S3. Make task capacity concurrency-safe
Source evidence: inspected `apply_to_task` and `submit_task` definitions count rows before insert without locking/reserving task capacity in those function bodies.
- Choose row locking, atomic capacity reservation, or a suitable constraint.
- Test concurrent requests at capacity and just below capacity.
- Preserve reapplication and per-user rules.

### S4. Complete privilege and RLS inventory
- Enumerate final grants and policies after every migration, not only individual historical snippets.
- Review all SECURITY DEFINER functions: fixed search_path, caller identity, explicit authorization, safe parameters and minimum grants.
- Confirm profile protected-column policy from the final migration state.
- Review role matrix for `user`, `job_seeker`, `employer`, `staff`, `admin`, and `super_admin`; document intended behavior before changing legacy role semantics.
- Verify private KYC and proof storage for owner, unrelated user, authorized reviewer and unauthorized staff.

### S5. Build validation and secrets
- Commit a reproducible lockfile and prove clean `npm ci` from repository state.
- Scan current and historical Git content for accidental secrets; rotate any exposed credential rather than merely deleting it.
- Keep CI on placeholders and no production database.
- Enable breached-password protection in the isolated auth project.

## Exit criteria for Step 2
- Complete migration/grant/policy/function inventory.
- Each finding classified as confirmed, not exploitable with evidence, or unresolved.
- A forward-only 2.0 migration plan reviewed against a fresh isolated schema.
- Tests for privilege boundaries, capacity races, withdrawal KYC gate and ledger reconciliation pass.
- No production data or live settings modified.


## Additional source-review items (2026-10-13)

- **S1 profile fields:** the first migration grants authenticated UPDATE on profiles and an owner-update policy; later fields include `suspended` and `withdrawal_hold`. Confirm final effective policies and replace broad owner writes with an explicit safe-column allowlist.
- **S4 privacy:** `get_user_reputation(uuid)` and `challenge_progress(uuid, challenges)` are SECURITY DEFINER and granted to authenticated callers; the inspected bodies accept caller-supplied user IDs. Decide which metrics are intentionally public and enforce self/staff access for private fields.
- **S4 role matrix:** legacy `admin` is handled inconsistently across helpers and some administrative listing logic. Define the role matrix for 2.0 and enforce it in every SQL function, RLS policy and route.
- **False-positive control:** an UPDATE grant on settings is paired with an RLS policy requiring super-admin, so the grant alone is not treated as a bypass. Boolean-only role helper execution grants are not by themselves proof of data exposure.
- **Coverage note:** source review covered the 20 SQL files in the checked-in migrations directory; the effective live database catalog and storage flows still require isolated-environment tests.


## Implemented in branch; validation pending

A new migration `20261013120000_zurify_2_0_column_level_privileges.sql` revokes broad authenticated-client profile INSERT/UPDATE and application UPDATE grants, then grants only profile-form fields and non-privileged application content columns. This is a source change only: the full migration chain has not yet been executed against a disposable database. Verify current client flows and direct REST attempts before considering the finding closed. Do not apply to production.


## New high-priority fix drafted (validation pending)

- **Analytics authorization:** the inspected `admin_analytics_series(integer)` SECURITY DEFINER function had no role check while authenticated users were granted execute. New migration `20261013123000_secure_analytics_and_internal_metrics.sql` requires `is_staff(auth.uid())` and bounds the date window to 1–365 days.
- **Internal metric helper exposure:** same migration revokes direct execute on `get_user_reputation(uuid)` and `challenge_progress(uuid, public.challenges)` from PUBLIC/anon/authenticated. These should remain callable through the existing protected SECURITY DEFINER parent RPCs only.
- Test in isolated DB before closing; do not apply to production.


## Test plan
See `docs/SECURITY_VALIDATION_MATRIX.md` for the proposed isolated Supabase test matrix. These cases are not marked passed until the complete migration chain has been applied to a disposable project and the tests have been run.


## Further fixes drafted (not yet database-tested)

- **Withdrawal KYC:** `20261013130000_enforce_withdrawal_kyc_and_release_reserves.sql` gates reservation on approved KYC, not only final approval. It also routes the older two-argument rejection RPC through the reserve-releasing authorized implementation.
- **Capacity races:** `20261013133000_serialize_task_capacity_checks.sql` adds row locks on the parent task in application and submission RPCs so concurrent calls serialize around the capacity count.
- **Ledger fee accounting:** `20261013140000_correct_withdrawal_ledger_entries.sql` records the actual net payout as the withdrawal transaction and records the fee separately, so net plus fee equals the gross request. Existing historical rows are not modified.
- Run the full migration chain and the security validation matrix against a disposable Supabase project before considering any of these findings closed.
