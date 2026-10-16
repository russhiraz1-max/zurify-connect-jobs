# Zurify 2.0 — Phase and Step Tracker

This file is the single durable progress tracker for the Zurify 2.0 work. Update it as changes are made and checks are run. A green frontend build is not proof that database policies, payment logic, or end-to-end flows are correct.

**Current location:** Phase 2 — Foundation and security  
**Current step:** Step 2.2 — Security/role audit and remediation proposals, with the client/AI-company foundations and locked admin-configuration work underway.  
**Latest verified frontend build:** GitHub Actions run #525 passed on code head `3573ce045810ffc02267c043de1ad8df335b5905`; patched TanStack Start versions were checked, `npm ci` passed, and both `npm run build` and `npm run typecheck` passed. **Latest isolated migration replay:** Supabase local-stack workflow run #95 passed: the full migration chain reset on disposable local Postgres and the expanded 51-assertion pgTAP smoke suite passed. This validates migration replay and those assertions, not full browser E2E, comprehensive cross-user RLS/storage behavior, concurrency stress or payment correctness. Vercel status for this head is green, but this is a preview check, not a production deployment or live-payment test.

Legend:
- `[x]` implemented and validated with evidence
- `[~]` implementation/source work exists, but validation or required scope remains
- `[ ]` not started or not implemented

## Phase 1 — Product discovery and source audit

- [~] Preserve the existing Zurify codebase and document product goals before broad changes.
- [~] Review the checked-in application, role model, authentication flow, and migration history.
- [~] Document source-level security findings and the required test matrix.
- [ ] Reconcile the checked-in migration history against a clean, isolated 2.0 database.
- [ ] Confirm the exact production/current Supabase project references without changing production.
- [ ] Finish the full audit of RLS, storage policies, function grants, environment-variable usage, and all money-moving RPC callers.

## Phase 2 — Foundation and security (CURRENT PHASE)

### Step 2.1 — Authentication and account-role foundation

- [~] Restrict redirect destinations to internal routes and improve post-auth navigation, including sending staff/admin/super-admin accounts to `/admin` by default while preserving explicit safe internal redirects.
- [~] Handle signup with email confirmation without prematurely entering a protected dashboard.
- [~] Add freelancer/client signup intent; the database trigger source accepts only non-privileged allowlisted roles.
- [~] Fix a password-recovery event/session race in the reset-password page.
- [~] Add post-OAuth account selection and a restricted `complete_account_type(text)` RPC. The current trigger/RPC allowlist supports `job_seeker`, `employer`, and `ai_company`; email signup intent is handled separately from OAuth users, who are directed through the authenticated chooser. The migration chain and smoke suite pass locally in CI; OAuth callback, confirmation, refresh and role behavior still need browser end-to-end tests.
- [ ] End-to-end test OAuth onboarding, password login, signup with confirmation on/off, confirmation links, logout, expired links, and password reset using synthetic accounts.
- [ ] Validate redirect allowlists and canonical callback URLs in a separate Supabase 2.0 project.

### Step 2.2 — Security and permissions (CURRENT STEP)

- [~] Draft column-level profile/application write restrictions.
- [~] Add an in-function staff guard to admin analytics and restrict direct execution of internal metrics helpers.
- [~] Draft KYC-before-withdrawal-reservation protection.
- [~] Draft atomic task-capacity checks by locking the parent task row.
- [~] Draft a withdrawal ledger correction; fee policy and ledger invariants still need isolated database tests and business confirmation.
- [~] Route legacy withdrawal rejection through reserve release and require the exact reserve to exist before release.
- [~] Align the client-side admin shell and sign-in routing with database `is_staff()` semantics (`staff`/`super_admin` only); the legacy `admin` role alone now fails closed in the frontend. Audit other RPCs and role policies for remaining legacy-role inconsistencies.
- [~] Add a staff-role guard to the shared admin shell so non-staff child content is not rendered while unauthorized users are redirected; backend RLS/RPC authorization still needs validation.
- [x] Replay the complete checked-in migration chain against a disposable local Supabase/Postgres stack in CI; workflow run #95 passed. This is not a production database test and does not replace end-to-end/RLS/storage/concurrency testing.
- [~] Run the 51-assertion pgTAP smoke suite for selected privileges, onboarding behavior, AI-company project gating and locked settings; it passed in CI run #95. Full cross-user RLS/storage and browser role-isolation tests remain.
- [~] Add a trigger guard for engagement claim rows (streak, lucky, mystery, challenge, badge) so authenticated claim writes require a non-suspended freelancer-only account; validate all trigger/RPC combinations in isolated Supabase before considering closed.
- [ ] Test withdrawal request/approval/rejection/retry paths, duplicate processing, reserve mismatch, ledger totals, and rollback behavior.
- [x] Resolve root `package.json` / `package-lock.json` dependency declaration drift; the latest CI run used `npm ci` against the committed lockfile. Continue checking transitive dependency security and reproducibility.
- [ ] Complete lint, automated tests, and a historical secret-exposure review.

### Step 2.3 — Safe client-workspace foundation

- [~] Add client workspace navigation for desktop and mobile.
- [~] Add a client draft workspace with active-category selection and own-task listing; publishing, client funding, billing and applicant management remain unimplemented. A distinct AI-company workspace is now being added in Phase 3.
- [~] Add a draft-only task creation form and own-task list.
- [~] Add client project/draft/published summaries and explicit messaging that funding is not enabled.
- [ ] Test role checks, RPC input validation, ownership RLS, and draft creation in an isolated database.
- [ ] Do not enable task publishing or accept client funds until review/moderation, budgets, and payment authorization exist.

**Phase 2 exit criteria:** authentication tests pass; role semantics are consistent across frontend and database; security migrations pass against a clean isolated database; withdrawal/wallet invariants are tested; dependency lockfile and CI are clean; production remains untouched.

## Phase 3 — Core marketplace and role-specific workflows

- [ ] Build the complete freelancer workflow: discovery, eligibility, applications, active work, evidence/submissions, feedback/rework, completed work, wallet history, payout eligibility, support and rewards.
- [ ] Build the complete client workflow: project creation/editing, review/publishing, applicants/workers, submission review, revisions, project budgets, spend tracking, invoices and receipts.
- [~] Add the first distinct AI-company foundation: organization verification, data-project drafts with language/dialect/locale/region and consent fields, organization/project owner isolation, staff review RPCs and submission gating. Batch assignment, QA sampling, dataset exports, organization seats and full lifecycle remain incomplete.
- [ ] Add project/task status transitions, capacity enforcement, audit logs and owner isolation.
- [ ] Preserve the six existing marketplace types and useful functionality where appropriate.

## Phase 4 — Payments, wallet and trust

- [~] Source audit found that withdrawal reserve/release movements are not represented as explicit rows in the current `wallet_transactions` history; define available/reserved/payout/fee semantics before treating it as authoritative.
- [ ] Design separate client-funding, client-spending, freelancer-earnings, withdrawal-reserve, provider-transaction and fee semantics.
- [ ] Confirm client deposit/refund/chargeback policy and withdrawal-fee policy with the founder.
- [ ] Implement the server-side payment-provider interface with Flutterwave as the first intended provider and future Paystack support.
- [ ] Implement verified webhooks, server-side transaction confirmation, idempotency, replay protection, receipts and reconciliation.
- [ ] Add automated task legitimacy/quality checks before eligible withdrawals, with clear explanations, manual review and appeals.
- [ ] Test only in gateway sandbox and synthetic accounts until separately approved.

## Phase 5 — New UI and protected admin control center

- [~] Begin authenticated workspace redesign with blue, sky blue, violet/purple accents, gradient surfaces and a clearer navigation hierarchy; client and freelancer navigation are separated in source, and the freelancer dashboard now redirects client-only accounts to the client workspace. Frontend build passed in run #272; role behavior still needs end-to-end testing.
- [ ] Redesign public landing pages and role-specific dashboards into a consistent Zurify 2.0 design system.
- [ ] Complete responsive mobile/desktop layouts, accessibility, loading/empty/error states and typography.
- [~] Add a super-admin-only runtime configuration RPC and control-center UI for theme palette, feature flags, preferred payment provider and maintenance mode. Database access is RPC-only, changes are audited, and live payments are hard-disabled. Role management, public maintenance enforcement and actual runtime application of every flag remain incomplete.
- [~] Enforce super-admin authorization in configuration RPCs and enforce client-draft/AI-workspace flags at the database boundary. Remaining flags (funding, live payments, dataset exports and promo codes) are intentionally locked off until their workflows exist.
- [ ] Remove obsolete Lovable-specific dependencies only after their responsibilities are understood and safely replaced.

## Phase 6 — Quality assurance and launch preparation

- [~] Run clean install/build/typecheck and isolated migration/security smoke tests after feature batches. Latest head `3573ce0` passed build, typecheck and the 51-assertion migration smoke suite. Lint, browser E2E, broad RLS/storage and role-isolation coverage remain incomplete.
- [ ] Test full client funding-to-project-to-worker-payment and freelancer earning-to-withdrawal paths using sandbox/synthetic accounts.
- [ ] Run security review for RLS, storage, auth, secrets, webhooks, rate limits, concurrency, audit logs and privacy.
- [ ] Validate email delivery and callback URLs in a separate environment.
- [ ] Prepare backups, monitoring, incident response, rollback steps and a controlled release plan.
- [ ] Obtain explicit founder approval before merging, applying production migrations, enabling live payments or deploying the 2.0 release.

## Operating guardrails

- Work on `feat/zurify-2.0-foundation` and keep changes reviewable.
- Keep the PR draft until the founder explicitly approves review/merge.
- Never apply proposed migrations to the existing production database as a shortcut.
- Never migrate or rewrite historical wallet, ledger, KYC, task, submission or withdrawal data without a separately reviewed and approved plan.
- Never commit secrets or expose them in `VITE_*` variables.
- Report the exact commit and check result; distinguish source review, compilation, and real database/end-to-end validation.


## Latest source-review follow-up — role isolation

A second pass found that the capacity migration required a `job_seeker` role for `apply_to_task`, but its paired `submit_task` RPC lacked the equivalent check. The withdrawal request RPC also relied on authentication/KYC/suspension checks without an explicit worker-role boundary. Source migrations now require a worker-only role for apply, submit and withdrawal, and fail closed for clients, special roles and mixed worker/client accounts. New direct-RPC cases are recorded in `docs/SECURITY_VALIDATION_MATRIX.md`.

**Validation status:** frontend build and clean local migration replay passed on the current verified code head. The 41-assertion smoke suite passes. Full SQL authorization/RLS, OAuth-provider E2E, concurrency stress, wallet invariants and payment/webhook behavior tests remain outstanding. This does not authorize production migration or live payout changes.


### Engagement reward guard follow-up

The claim-row trigger now uses a strict role allowlist: the caller must have `job_seeker` and must not have any role other than baseline `user` or `job_seeker`. This is safer than enumerating known client/admin roles because future roles (including the planned AI-company role) fail closed by default. Validation cases R-20/R-21 were added to the security matrix. The complete migration chain now passes local replay, including this guard. Full worker claim/RPC behavior and trusted service-role combinations still need dedicated tests.
