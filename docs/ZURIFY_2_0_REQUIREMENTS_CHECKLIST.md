# Zurify 2.0 — Master Requirements and Completion Tracker

This document is the durable checklist for the Zurify 2.0 work. Update status only when code and validation evidence exist. Keep it in the repository so scope is not lost between work sessions.

Legend: [ ] not complete, [~] in progress, [x] completed and verified.

## 0. Non-negotiable safety and delivery rules
- [x] Work on `feat/zurify-2.0-foundation`; keep changes reviewable.
- [x] Open a draft pull request; never merge or deploy without the founder's explicit approval.
- [ ] Keep current production database, users, wallets, wallet ledger, KYC, jobs/tasks, submissions and withdrawals untouched.
- [ ] Create a distinct Supabase project/database for 2.0; do not assume the existing project references are correct.
- [ ] Test only against the isolated 2.0 project or a local database with synthetic accounts.
- [ ] Do not copy production personal/financial/identity data unless a separately approved migration plan is written.
- [ ] Preserve the existing product's useful behavior; improve the current codebase instead of blindly rewriting it.
- [ ] Never claim a test passed unless the actual result is available.
- [ ] Keep a record of each implementation, migration, test, failure and fix.

## 1. Brand, product and user journeys
- [ ] Keep the tagline “Find work. Get paid.”
- [ ] Premium, modern Zurify experience: blue, light blue/sky blue, dark blue and white; no gold.
- [ ] Keep the public product positioning: micro tasks, gigs, freelance projects, remote opportunities, service requests and contests.
- [ ] Free signup with a clear role choice and role-specific onboarding questions.
- [ ] Distinct freelancer dashboard and workflow.
- [ ] Distinct client dashboard and workflow for posting work, managing applicants, reviewing delivery and tracking spend.
- [ ] Distinct AI-company workflow; AI companies must not be treated as ordinary freelancers or just another client account.
- [ ] Add promotional/promo codes with server-side validation, eligibility, expiry/usage limits and audit history.
- [ ] Improve mobile and desktop responsiveness, accessibility, loading/empty/error states and clear navigation.
- [ ] Update site metadata, canonical URLs and copy to remove obsolete Lovable-hosted origins where appropriate.
- [ ] Verify all claims and counters shown publicly; do not leave fictional testimonials or unsupported company/user statistics.

## 2. Authentication and account security
- [~] Fix signup behavior when email confirmation is enabled; never send a user into a protected dashboard without a session.
- [~] Route confirmed/authenticated users from the callback/home entry path into the right authenticated experience.
- [ ] Test password sign-in, signup with confirmation on/off, confirmation links, Google OAuth, logout, expired links and password recovery end-to-end.
- [ ] Make callback URLs derive from a canonical site URL and configure the exact allowed URLs in the new Supabase project.
- [ ] Ensure redirect destinations are restricted to safe internal routes.
- [ ] Standardize password policy across signup and reset, and use clear non-sensitive errors.
- [ ] Confirm role assignment cannot be self-escalated by client-controlled signup metadata or profile updates.
- [ ] Replace Lovable authentication only after understanding its existing OAuth/session responsibilities and verifying a complete replacement.

## 3. Admin control center and authorization
- [ ] Build a locked admin-only settings/control center.
- [ ] Centralize site theme/color settings, feature flags, provider selection, maintenance mode and relevant platform configuration.
- [ ] Enforce permissions on the server/database, not just by hiding frontend routes or buttons.
- [ ] Align `admin`, `staff`, `super_admin` and other legacy role behavior across frontend and SQL.
- [ ] Restrict role assignment and permission changes to authorized super-admin paths with audit logs.
- [ ] Test direct URL access, RPC calls, table access and storage access as anonymous, freelancer, client, AI-company, staff, admin and super-admin users.
- [ ] Review admin analytics and any SECURITY DEFINER function for missing role checks and unnecessary exposure.
- [ ] Preserve an audit trail for sensitive configuration, identity review, wallet, withdrawal and moderation actions.

## 4. Marketplace and AI workforce
- [ ] Preserve/improve existing job types and categories without breaking current useful workflows.
- [ ] Add AI-company project creation for data collection, language/cultural tasks, transcription, pronunciation, data labeling and similar AI data work.
- [ ] Support project batches, task assignment/capacity, worker instructions, submission evidence, review queues and rework/rejection reasons.
- [ ] Add quality controls: duplicate detection, gold/benchmark tasks where appropriate, agreement/scoring, suspicious-pattern checks, sampling and human escalation.
- [ ] Support language/culture metadata such as locale, language, dialect, accent, region and task-specific consent where relevant.
- [ ] Support exportable, permission-controlled project datasets and clear status/quality summaries for AI-company customers.
- [ ] Keep contributor privacy, consent, retention and data-use permissions explicit; do not expose private raw submissions to other customers or workers.
- [ ] Prevent overbooking and race conditions with database-level locking/atomic capacity reservation.
- [ ] Add automated job/task legitimacy and quality checks before eligible earnings can be withdrawn; automated checks must be explainable and support review/appeal for false positives.
- [ ] Add client spending, project budget, invoice/usage visibility and clear status transitions.

## 5. Wallet, withdrawals and payment gateways
- [ ] Keep the internal wallet ledger authoritative and separate from gateway transactions.
- [ ] Keep money values as integer minor units (cents); no floating-point balance math.
- [ ] Introduce a server-side payment-provider abstraction; Flutterwave is the intended first provider, with future Paystack support possible.
- [ ] Make provider selection an admin-only configuration backed by server-side validation.
- [ ] Implement signed webhook verification, server-side transaction verification, idempotency, duplicate/replay handling and reconciliation before enabling real payments.
- [ ] Keep all payment secrets server-side in deployment environment variables/managed secret storage; never put secrets in source, browser bundles, `VITE_*` variables or chat.
- [ ] Keep test/sandbox and live credentials/environments strictly separate.
- [ ] Define deposit/refund/chargeback/failure handling before enabling related money flows.
- [ ] Audit withdrawal request, reservation, approval, rejection, cancellation and retry flows so every branch releases or consumes reserved funds exactly once.
- [~] Require approved identity verification before funds are reserved for a withdrawal, if this is the intended policy; inspected request_withdrawal definition does not check KYC before reserving. Verify intended policy and test all failure paths.
- [ ] Confirm the new withdrawal-fee policy before implementation; historical records must not be silently rewritten.
- [~] Preserve duplicate-approval guards and add reconciliation/invariant tests for ledger, available balance, reserved funds, fees and payout net amount; inspected withdrawal approval records gross withdrawal and a separate fee transaction, requiring invariant review.
- [ ] Add payout status tracking, provider references, safe retries and administrator audit records.
- [ ] Do not enable real transactions until provider configuration, webhook security, sandbox tests and reconciliation are verified.

## 6. Database, RLS, storage and migration discipline
- [ ] Review all migrations and current schema before writing new schema changes.
- [ ] Resolve the existing `supabase/config.toml` versus client/project-reference mismatch by documenting the new 2.0 project explicitly.
- [ ] Write clearly named, repeatable migrations for the isolated 2.0 database; do not blindly replay old migrations against live data.
- [~] Audit RLS on every exposed table and bucket; source review confirmed an application-owner UPDATE policy/grant risk; complete full migration/grant reconciliation and access-path tests.
- [~] Audit SECURITY DEFINER functions for fixed search_path, role checks, least-privilege grants and safe parameters; function-by-function review remains in progress.
- [ ] Protect profile fields such as suspension/withdrawal holds from self-editing.
- [~] Protect application/submission status, reviewer identity, review notes, wallet fields and role fields from unauthorized client updates; application table-level UPDATE + owner policy is confirmed in migration source and requires 2.0 remediation.
- [ ] Restrict private KYC documents and submission proof storage to the subject and explicitly authorized reviewers.
- [ ] Remove unsafe legacy function overloads only after checking all dependencies and callers.
- [ ] Add indexes selectively after checking query plans and workload; address unindexed foreign keys and redundant policies without broad untested rewrites.
- [ ] Enable breached-password protection in the new auth configuration.
- [ ] Add database-level tests for role isolation, wallet invariants, concurrency and duplicate processing; source review confirmed count-then-insert capacity checks that need concurrency-safe design.

## 7. Email, notifications and operational setup
- [ ] Configure Resend for verified transactional email in the 2.0 environment; no API key is needed in source control.
- [ ] Test confirmation, password reset, security notifications and relevant project/task email.
- [ ] Audit existing notification/realtime behavior before replacing or removing it.
- [ ] Document environment variables and which belong in Vercel server environment versus browser-visible configuration.
- [ ] Add deployment health checks, useful logs without secrets/PII, and operational error handling.

## 8. Lovable cleanup and maintainability
- [ ] Inventory all Lovable packages, generated files, auth behavior, error reporting and Vite/TanStack integration before removal.
- [ ] Replace each required responsibility and prove parity before removing a dependency.
- [ ] Update stale names, URLs, metadata and copy only where grounded.
- [ ] Add or repair formatting, lint, type-check, unit/integration and production-build scripts.
- [ ] Fix lockfile drift and ensure clean reproducible installs.
- [ ] Add CI with no real production credentials and no production database access.
- [ ] Run the development app and repeatedly test core flows as code changes land.

## 9. Required acceptance tests before completion
- [ ] Clean dependency install from a fresh checkout.
- [ ] Type-check and lint; record pre-existing failures separately from regressions.
- [ ] Production build.
- [ ] Signup, email confirmation, login redirect, OAuth, logout and password recovery.
- [ ] Role-specific onboarding and direct-access authorization tests.
- [ ] Admin/settings authorization tests.
- [ ] Client creates project/job; worker applies/completes; client/AI company reviews; wallet credits once.
- [ ] Concurrent capacity reservation and duplicate submission approval tests.
- [ ] Withdrawal reservation, KYC gate, rejection release, approval, fee/net amount, idempotency and ledger reconciliation tests.
- [ ] Payment provider sandbox and webhook signature/replay tests before real payment activation.
- [ ] Storage/RLS privacy tests.
- [ ] Responsive UI checks on mobile and desktop.
- [ ] Fresh isolated Supabase database migration test.
- [ ] Founder review of the preview/PR; no merge or production deployment until explicit approval.

## 10. Deployment configuration to complete later
- [ ] Create the separate Supabase 2.0 project and verify its URL/keys.
- [ ] Configure Vercel project and preview/production environments without pointing the new build at the old production database.
- [ ] Configure canonical site URL and Supabase redirect allowlist.
- [ ] Configure Resend domain/sender and server-side API key.
- [ ] Configure Flutterwave sandbox credentials server-side; switch to live only after approved acceptance tests.
- [ ] If/when Paystack is implemented, configure it as a separate provider with its own verification and reconciliation tests.
- [ ] Set up admin bootstrap securely without hardcoding a privileged user or accepting role metadata from signup.
- [ ] Write an explicit launch/rollback and data-migration decision before any cutover.

## Current checkpoint
- Step 2 security review: source-level findings documented in `docs/INITIAL_SECURITY_AUDIT.md`; application-update policy, KYC withdrawal gate and withdrawal ledger semantics require remediation/design before isolated database verification. No production database was changed.
- Feature branch: `feat/zurify-2.0-foundation`
- Draft PR: `https://github.com/russhiraz1-max/zurify-connect-jobs/pull/1`
- Auth redirect/signup-confirmation changes and initial secret hygiene are in progress; not yet fully validated.
- Initial CI found `package.json` and `package-lock.json` out of sync. This is tracked as work, not considered fixed merely because the workflow was adjusted.
- No production merge, deployment, database migration or production data transfer is authorized.
