
This is a large transformation. To keep it shippable and reviewable, I'll deliver it in phases. Phase 1 lands the full backend + core user + admin flows so the platform is usable end-to-end. Phases 2–3 layer on staff permissions, support/reports, and public content pages.

## What changes vs. today

The existing app is a jobs board (`jobs`, `applications`). Zurify becomes a task-earning platform. I'll **retire the jobs surface** (drop `jobs` and `applications` tables; delete `/jobs` routes) and replace it with tasks, submissions, wallets, and withdrawals. Branding, auth, theme, header/footer, and the `_authenticated` gate stay.

## Phase 1 — Core platform (this turn)

### Database (single migration)

New enums: `app_role` extended to `super_admin | staff | user | advertiser` (migrate existing `job_seeker`/`employer`/`admin` → `user`/`advertiser`/`super_admin`), `task_status`, `submission_status`, `withdrawal_status`, `withdrawal_method`, `tx_type`, `notification_type`, `report_status`, `ticket_status`.

Tables (all with RLS + GRANTs + `updated_at` trigger where relevant):
- `application_settings` (singleton row: super_admin_email, min_withdrawal_cents=300, fee_bps_per_unit=1000, withdrawal_unit_cents=300, paypal_instructions, etc.)
- `task_categories` (name, slug, icon)
- `tasks` (title, description, instructions, proof_requirements, category_id, reward_cents, max_per_user, max_total, starts_at, ends_at, est_minutes, status, featured, priority, created_by)
- `task_submissions` (task_id, user_id, proof_text, proof_url, attachments jsonb, status, reviewer_id, review_notes, rejection_reason, reviewed_at)
- `submission_attachments` handled via `attachments jsonb` + storage bucket
- `wallets` (user_id unique, available_cents, pending_cents, lifetime_earned_cents, lifetime_withdrawn_cents)
- `wallet_transactions` (wallet_id, user_id, type, amount_cents, balance_after_cents, reference_type, reference_id, memo)
- `withdrawal_requests` (user_id, method, destination jsonb {paypal_email}, amount_cents, fee_cents, net_cents, status, reviewer_id, rejection_reason, processed_at)
- `notifications` (user_id, type, title, body, link, read_at)
- `announcements` (title, body, audience, published_at, created_by)
- `reports` (reporter_id, target_type, target_id, reason, details, status, handled_by)
- `support_tickets` + `support_ticket_messages`
- `audit_logs` (actor_id, action, target_type, target_id, meta jsonb, ip)
- `staff_permissions` (user_id, permission text) — enum of: `review_submissions`, `review_reports`, `reply_tickets`, `view_users`, `view_tasks`, `view_withdrawals`, `approve_withdrawals`

Security-definer helpers (search_path=public): `has_role`, `has_permission(uid, perm)`, `is_super_admin(uid)`, `is_staff_or_admin(uid)`, `current_settings_row()`.

Wallet integrity via SECURITY DEFINER functions (only path that writes wallet balances):
- `approve_submission(submission_id)` → credits reward to available, inserts `wallet_transactions` row (`type='earning'`), sets submission approved, notifies user, audit-logs.
- `reject_submission(submission_id, reason)` → status + notify + audit.
- `request_withdrawal(amount_cents, method, destination)` → validates ≥ min & multiple-of-unit, computes fee (`floor(amount/unit)*unit*bps/10000`), reserves by moving amount from available → pending withdrawal via a pending row (no balance change until approval per spec: "deduct on approval"). We'll take the safer approach: **reserve on request** (move from available to a reserved column) and finalize on approval; simpler: check available ≥ amount at approval and deduct then. I'll implement **check + deduct on approval** to match the spec literally.
- `approve_withdrawal(id)` → deduct available, +lifetime_withdrawn, insert tx (`type='withdrawal'`, `-amount`) + fee tx (`type='fee'`), notify, audit.
- `reject_withdrawal(id, reason)` → status + notify + audit.
- `submit_task(task_id, proof_text, proof_url, attachments)` → validates windows, per-user cap, total cap, inserts submission (`pending`), notifies admins.
- `handle_new_user()` trigger → creates profile, wallet, assigns role (`super_admin` if email = settings.super_admin_email, `staff` if matches staff bootstrap email, else `user`).

RLS summary:
- `tasks`: SELECT public where `status='published'` AND within window; super_admin/staff full read; only super_admin write.
- `task_submissions`: user reads own; super_admin + staff w/ `review_submissions` read all; inserts via `submit_task` RPC only.
- `wallets` / `wallet_transactions`: user reads own; super_admin reads all; no direct client writes (RPC only).
- `withdrawal_requests`: user reads/creates own; super_admin (+staff w/ perm) reads all & approves via RPC.
- `notifications`: user reads/updates own read_at.
- `application_settings`: authenticated SELECT of public-safe columns; only super_admin UPDATE.
- `audit_logs`: super_admin read only.
- `reports`, `support_tickets`: users manage own; staff w/ perm read/update.
- `staff_permissions`, `user_roles`: super_admin write; user reads own.

Storage buckets (created via tool): `submission-proofs` (private), `avatars` (public), `attachments` (private) with RLS on `storage.objects`.

Seed: default settings row, category set (Social Media, Surveys, App Testing, Reviews, Signup Offers, Other). Super_admin/staff assignment happens at signup for the two configured emails via the trigger; if the user already exists we'll insert their role rows in the migration too (idempotent).

### Server functions (`src/lib/*.functions.ts`, `requireSupabaseAuth`)
- `submitTask`, `listTasks`, `getTask`, `listMySubmissions`
- `getMyWallet`, `listMyTransactions`
- `createWithdrawal`, `listMyWithdrawals`, `quoteWithdrawalFee`
- `listMyNotifications`, `markNotificationRead`
- Admin: `adminListSubmissions`, `approveSubmission`, `rejectSubmission`, `adminListWithdrawals`, `approveWithdrawal`, `rejectWithdrawal`, `adminUpsertTask`, `adminListUsers`, `adminUpdateSettings`, `adminListAuditLogs`, `inviteStaff`, `setStaffPermissions`.

### Frontend

Retire: `/jobs`, `/jobs/$id` route files; strip Jobs link.

New routes:
- Public: `/`, `/about`, `/how-it-works`, `/faq`, `/contact`, `/privacy`, `/terms`, `/cookies`
- Authenticated user: `/dashboard` (overview + wallet cards), `/tasks`, `/tasks/$id`, `/submissions`, `/wallet`, `/withdrawals`, `/withdrawals/new`, `/notifications`, `/profile`, `/settings`, `/support`
- Admin (under `_authenticated/admin/` gated by `is_super_admin` or staff perms; returns 403 otherwise; not linked in public nav — only shown in header dropdown when role qualifies):
  - `/admin` overview, `/admin/tasks`, `/admin/tasks/new`, `/admin/tasks/$id`, `/admin/submissions`, `/admin/withdrawals`, `/admin/users`, `/admin/staff`, `/admin/categories`, `/admin/reports`, `/admin/announcements`, `/admin/audit-logs`, `/admin/settings`

Landing page rewritten around "Complete tasks. Get paid." with featured tasks, how-it-works, FAQ teaser. Auth page enforces email verification (block dashboard until `email_confirmed_at` set, with a "resend verification" CTA on a `/verify-email` interstitial).

Withdrawal form shows requested / fee / net breakdown live; enforces min $3 and $3 multiples.

### Tech details

- Fee formula: `fee_cents = floor(amount_cents / 300) * 30` (10% per $3 unit).
- All monetary values stored as integer cents.
- Rate limiting on login: client-side attempt throttle + `audit_logs` review (no infra primitive per platform policy — will note this in memory).
- 2FA (TOTP): Supabase MFA enrollment surfaced in `/settings` (enroll/verify/unenroll) — optional per spec.
- Session expiration: rely on Supabase JWT expiry defaults; no custom timer.
- Super admin email + staff bootstrap email stored in `application_settings`; trigger reads on signup.
- OG image omitted (no meaningful asset yet).

## Phase 2 (next turn, on approval)
- Full support ticket UI + staff reply threads
- Reports UI (user report flow on tasks; staff/admin queues)
- Announcements composer + banner
- Referral scaffolding
- Advertiser role UX

## Phase 3
- Polish: empty states, skeletons, animations pass, accessibility sweep, analytics tiles

## Out of scope (explicit)
- Real payment gateway (PayPal is manual per spec)
- Email delivery (notifications are in-app; auth emails via Supabase default)
- True infra rate limiting (platform has no primitive)

If this shape looks right, I'll ship Phase 1 next turn: one migration, three storage buckets, all server fns, all routes above. Reply "go" or tell me what to adjust (e.g. keep jobs alongside tasks, defer admin dashboard, change fee model).
