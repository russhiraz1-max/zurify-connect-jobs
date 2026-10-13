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
| A-07 | Member A attempts direct INSERT into task_applications with status='approved' or reviewer metadata | Denied; applications must be created through apply_to_task RPC |

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

## Freelancer/client task role isolation

| Test | Action | Expected result |
|---|---|---|
| T-01 | Legacy user-only account passes the safe role backfill | Gets job_seeker only if it has no existing worker/client/special role |
| T-02 | Client calls apply_to_task directly for a published task | Denied by the RPC |
| T-03 | Client calls submit_task directly for a published task | Denied by the RPC |
| T-04 | Staff, super-admin, legacy admin, advertiser, or dual worker/client role calls apply_to_task or submit_task | Denied by the RPC |
| T-05 | New OAuth account without completed account-type onboarding calls worker RPCs | Denied because job_seeker role is absent |
| T-06 | Ordinary job_seeker account applies/submits while active and within task limits | Allowed, with existing capacity and suspension checks preserved |

## Withdrawals and ledger invariants — design/test required before implementation is approved

- KYC-pending/rejected users cannot reserve or receive payout funds.
- A request reserves no more than available balance; concurrent requests cannot overspend.
- Every request's gross amount, fee and net amount satisfy a single documented equation.
- Approval is idempotent; duplicate approval cannot debit twice or pay twice.
- Rejection/cancellation releases the entire reserved amount exactly once.
- PostgREST resolves the two-argument rejection RPC to the compatibility wrapper and the three-argument RPC to the explicit suspend-flag overload; neither call is ambiguous.
- Every wallet balance change is backed by exactly one consistent ledger event.
- Withdrawal request, reserve, approval, rejection/release, payout and fee history reconciles without double-counting; current source is known to omit explicit reserve/release transaction rows and requires a ledger design decision before this test can pass.
- Test minimum, amount unit, fee rounding, suspension, withdrawal hold, KYC and insufficient-balance paths.
- Never alter historic production ledger rows as part of tests.

## Task capacity and concurrency

- Concurrent applications cannot exceed task capacity.
- Concurrent submissions cannot exceed per-user or task-wide limits.
- Duplicate active applications remain prevented.
- Repeated/replayed approval cannot issue duplicate earnings.
- Suspension blocks apply/submit operations at the database layer, not just the UI.
- A user whose profile row is missing cannot call apply/submit; no application/submission is inserted.
- Concurrent suspension and apply/submit operations serialize on the profile row; if suspension wins the lock first, the task action is denied.

## Exit criteria

Do not close security findings until the complete migration chain applies cleanly to a fresh isolated project and every relevant test above passes. Record database version, migration head, synthetic test identities/roles (no credentials), test results, and any known exceptions. No production migration or launch is authorized by this checklist.

## Employer/client draft task tests (required)
- Freelancer/user without `employer` role cannot call `create_client_task`, even if they invoke the RPC directly.
- Employer can create a valid draft; inserted row has `created_by=auth.uid()`, `status='draft'`, `featured=false`, and `priority=0`.
- Employer cannot use direct table writes to publish, feature, reprioritize, edit, or delete a task.
- Employer A cannot read Employer B's draft through the Data API.
- Suspended employer cannot create a draft.
- Invalid/oversized title, description, instructions, reward, estimated time, capacity, nonexistent category, and inactive category are rejected server-side.
- Staff/admin task review and existing publish controls continue to work.
- Signup with forged metadata such as `account_type='super_admin'` or `'staff'` must receive only the safe default `job_seeker` role plus baseline `user`; metadata `'employer'` may add only the `employer` role.


## OAuth account-type onboarding (new source; not yet executed)

| Test | Action | Expected result |
|---|---|---|
| O-01 | New email/password signup with `account_type=employer` | Trigger assigns baseline `user` and `employer`; no privileged role is granted |
| O-02 | New email/password signup with missing/unknown account metadata | Trigger defaults to `job_seeker` plus baseline `user` |
| O-03 | New OAuth signup, including when user metadata contains an `account_type` value | Trigger creates profile/wallet and baseline role but no worker/client role; root redirects to account-type onboarding |
| O-04 | Authenticated user selects `employer` in onboarding | RPC assigns only `employer`; client workspace opens |
| O-05 | Authenticated user selects `job_seeker` in onboarding | RPC assigns only `job_seeker`; freelancer dashboard opens |
| O-06 | User submits `admin`, `staff`, `super_admin`, `advertiser`, or any unknown role to onboarding RPC | Denied server-side; no role is added |
| O-07 | User with an existing worker/client role attempts to change it through the onboarding RPC | Denied unless requesting the same role, which is idempotent |
| O-08 | Existing OAuth user with an existing application role signs in | No account-type prompt and no silent role change |
| O-09 | Two concurrent onboarding submissions choose different roles | At most one role is assigned; the other request fails without leaving both roles assigned |
| O-10 | Authenticated user without a profile calls the onboarding RPC | Denied; no role is added |
| O-11 | User already has both `job_seeker` and `employer` due to inconsistent legacy data and calls onboarding RPC | Denied with a conflict error; no additional role is granted |


## Role-aware post-auth routing

| Test | Action | Expected result |
|---|---|---|
| R-01 | Ordinary freelancer signs in or returns through OAuth callback | `/dashboard` |
| R-02 | Client signs in or returns through OAuth callback | `/client-dashboard` |
| R-03 | Staff, legacy admin, or super-admin returns through `/` or `/auth` | `/admin`, subject to the admin route's own authorization checks |
| R-04 | Advertiser without a worker/client role returns through OAuth | No account-type chooser; route to the default dashboard until the advertiser-specific workflow is implemented |
| R-05 | User explicitly requests a safe internal non-default redirect | Preserve that internal destination |
| R-06 | Redirect parameter is protocol-relative, contains backslashes or control characters | Reject it and use the safe default |


## Admin route and console access

| Test | Action | Expected result |
|---|---|---|
| A-01 | Anonymous visitor opens an authenticated admin route | Authentication gate redirects to sign-in; no admin child content renders |
| A-02 | Authenticated freelancer/client/advertiser opens an admin route | Admin shell renders no protected child content and redirects to their ordinary dashboard |
| A-03 | Staff user opens the admin overview and a tool without its permission | Overview follows the intended staff policy; unauthorized tool data/RPCs are denied by the backend |
| A-04 | Super-admin opens admin console | Full console is visible and sensitive backend operations still verify super-admin/staff permissions |


## Explicit worker-role boundary tests (added after source review)

| ID | Test | Expected result |
|---|---|---|
| R-11 | Client account calls `submit_task` directly through RPC | Denied server-side with freelancer-account-required error; no submission is inserted |
| R-12 | Client account calls `apply_to_task` directly through RPC | Denied server-side; no application is inserted |
| R-13 | Client account with a wallet/KYC row calls `request_withdrawal` directly | Denied server-side before any wallet reserve changes |
| R-14 | Account has both `job_seeker` and `employer` roles | Worker apply/submit/withdraw operations fail closed pending role reconciliation |
| R-15 | Existing user-only account after the role-backfill migration | Receives `job_seeker` only if it has no worker/client/special role; verify it can use legitimate worker flows |
| R-16 | OAuth account before completing account-type onboarding | Cannot apply, submit or request a withdrawal |


| ID | Test | Expected result |
|---|---|---|
| W-11 | Reject one withdrawal while the wallet's aggregate pending reserve differs from the sum of all pending withdrawal requests | Rejection fails atomically with a reconciliation error; neither wallet balances nor request status change |
| W-12 | Two concurrent rejection attempts target different pending withdrawals for the same wallet | Wallet row lock serializes reserve checks; each successful rejection releases only its own request, and duplicate/retried rejection cannot release twice |


## Withdrawal fee arithmetic tests (added after source review)

| ID | Test | Expected result |
|---|---|---|
| W-13 | Fee basis points are NULL, negative, or above 10,000 | Withdrawal request fails before changing wallet balances |
| W-14 | Fee configuration would make net payout zero or negative | Withdrawal request fails; no reserve or request is created |
| W-15 | Large valid cent amount is used with a valid fee rate | Numeric intermediate arithmetic avoids 32-bit multiplication overflow; gross equals net plus fee |

| W-16 | Minimum withdrawal amount is NULL or non-positive in settings | Request fails with invalid-settings error before moving funds |
