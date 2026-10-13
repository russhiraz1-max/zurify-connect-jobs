# Zurify 2.0 Security Validation Matrix

Status: planned test cases; **not yet executed**. Run only against a disposable Supabase project created for Zurify 2.0 with synthetic users and fake wallet balances. Never run destructive setup SQL or test withdrawals against production.

## Test identities

Create separate synthetic accounts:
- **Member A** — ordinary authenticated user.
- **Member B** — second ordinary authenticated user.
- **Staff** — staff account with only the permissions explicitly required by the test.
- **Super admin** — isolated test super-admin account.

Use only fake profile data and synthetic wallet ledger entries. Disable outbound email/payout side effects or use sandbox-only providers.

## Column-level write permissions

| Test | Action | Expected result |
|---|---|---|
| P-01 | Member A updates their own safe profile fields: full_name, headline, bio, location, website | Allowed |
| P-02 | Member A updates suspended or withdrawal_hold through PostgREST | Denied by database column privileges |
| P-03 | Member A attempts direct INSERT into profiles | Denied; signup trigger creates profile |
| P-04 | Member A updates Member B's profile | Denied by RLS |
| A-01 | Member A edits allowed application content columns on their own application | Allowed only if row policy permits |
| A-02 | Member A attempts to change application status, reviewer_id, review_notes, rejection_reason, or reviewed_at directly | Denied by database column privileges |
| A-03 | Member A attempts to update Member B's application | Denied by RLS |
| A-04 | Member A cancels own pending application through the authorized RPC | Allowed, with expected status transition |
| A-05 | Member A attempts to approve/reject an application through an admin RPC | Denied |
| A-06 | Authorized reviewer uses review RPC | Allowed and audit log written |

## Analytics and internal SECURITY DEFINER helpers

| Test | Action | Expected result |
|---|---|---|
| R-01 | Unauthenticated/anon invokes admin_analytics_series | Denied |
| R-02 | Member A invokes admin_analytics_series | Denied with authorization error |
| R-03 | Staff invokes admin_analytics_series with _days = 30 | Allowed, returns daily aggregate rows only |
| R-04 | Staff invokes with _days = 0, negative, NULL or very large number | Window safely bounded to 1–365 days |
| R-05 | Member A directly invokes get_user_reputation(uuid) | Denied at execute privilege level |
| R-06 | Member A directly invokes challenge_progress(uuid, challenges) | Denied at execute privilege level |
| R-07 | Member A uses protected get_my_engagement() RPC | Own engagement summary still works |
| R-08 | Member A claims an eligible challenge | Claim flow still works and only calculates Member A's progress |

## Withdrawals and ledger invariants — design/test required before implementation is approved

- KYC-pending/rejected users cannot reserve or receive payout funds.
- A request reserves no more than available balance; concurrent requests cannot overspend.
- Every request's gross amount, fee and net amount satisfy a single documented equation.
- Approval is idempotent; duplicate approval cannot debit twice or pay twice.
- Rejection/cancellation releases the entire reserved amount exactly once.
- Every wallet balance change is backed by exactly one consistent ledger event.
- Test minimum, amount unit, fee rounding, suspension, withdrawal hold, KYC and insufficient-balance paths.
- Never alter historic production ledger rows as part of tests.

## Task capacity and concurrency

- Concurrent applications cannot exceed task capacity.
- Concurrent submissions cannot exceed per-user or task-wide limits.
- Duplicate active applications remain prevented.
- Repeated/replayed approval cannot issue duplicate earnings.
- Suspension blocks apply/submit operations at the database layer, not just the UI.

## Exit criteria

Do not close security findings until the complete migration chain applies cleanly to a fresh isolated project and every relevant test above passes. Record database version, migration head, synthetic test identities/roles (no credentials), test results, and any known exceptions. No production migration or launch is authorized by this checklist.

## Employer/client draft task tests (required)
- Freelancer/user without `employer` role cannot call `create_client_task`, even if they invoke the RPC directly.
- Employer can create a valid draft; inserted row has `created_by=auth.uid()`, `status='draft'`, `featured=false`, and `priority=0`.
- Employer cannot use direct table writes to publish, feature, reprioritize, edit, or delete a task.
- Employer A cannot read Employer B's draft through the Data API.
- Suspended employer cannot create a draft.
- Invalid/oversized title, description, instructions, reward, estimated time, capacity, and nonexistent category are rejected server-side.
- Staff/admin task review and existing publish controls continue to work.
- Signup with forged metadata such as `account_type='super_admin'` or `'staff'` must receive only the safe default `job_seeker` role plus baseline `user`; metadata `'employer'` may add only the `employer` role.
