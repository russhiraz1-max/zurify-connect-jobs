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
