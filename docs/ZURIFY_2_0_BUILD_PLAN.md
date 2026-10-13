# Zurify 2.0 Build Plan

## Safety boundary
- Use this branch for Zurify 2.0 work; do not modify `main` as part of this workflow.
- Create a separate Supabase project/database for Zurify 2.0.
- Never apply new migrations to the live production database or move production user, wallet, ledger, KYC, task, or withdrawal data without a separately approved migration plan.
- Do not merge or deploy without the owner's explicit approval.

## Product requirements
- Preserve and improve useful functionality from the existing repository rather than starting a greenfield rewrite.
- Provide distinct onboarding and workflows for freelancers, clients, and AI companies.
- Build an AI data-work workflow for language/cultural data, labeling, transcription, batch review, quality checks, and exports.
- Improve freelancer and client dashboards, authentication redirects, email confirmation, and password recovery.
- Add a protected admin control center for settings, themes, feature flags, and payment-provider configuration.
- Use Zurify's blue, light-blue, dark-blue, and white brand direction; do not introduce gold.
- Remove unnecessary Lovable-specific dependencies only after their functional responsibilities have been understood and replaced safely.

## Payments and secrets
- Design a provider abstraction with Flutterwave as the first intended provider and room for future providers.
- Keep secret API keys server-side, in deployment environment variables or a managed secret store; never commit secrets or expose them to browser code.
- Implement server-side payment verification and idempotency before enabling real transactions.
- Keep the internal wallet ledger separate from external gateway transactions.
- Confirm the withdrawal-fee transition policy before changing behavior; never silently rewrite historical ledger records.

## Security and data integrity
- Audit authentication, role enforcement, RLS policies, SECURITY DEFINER functions, storage access, wallet operations, withdrawal reservation/rejection paths, and task-capacity concurrency.
- Align admin/staff/super-admin authorization between frontend and database.
- Add regression coverage for duplicate submission approval, wallet accounting, withdrawal holds/reservations, and role isolation.

## Validation and delivery
- Inspect the complete source and migration history before making schema changes.
- Create clearly named, documented migrations for the new database and test them against an isolated development database.
- Add appropriate type, lint, build, unit/integration, and authentication-flow checks where the stack supports them.
- Test signup, email confirmation, login redirects, password reset, role-specific access, and payment flows with synthetic test accounts.
- Deliver changes in reviewable commits and pull requests. Report tests honestly; do not claim checks passed unless they were run.
- Keep production untouched until explicit approval.

## Signup role foundation (source-only, not yet DB-tested)
The signup form now lets a person choose **Find work** or **Hire talent**. A new trigger migration stores this as a non-privileged `job_seeker` or `employer` role while retaining the baseline `user` role and the existing trusted super-admin bootstrap. User-editable auth metadata is never accepted for staff/admin privileges. This is only the account-type foundation; separate client/AI-company workflows and role-specific task ownership/RLS remain subsequent milestones.
