# Zurify 2.0 — Wallet, Client Funding and Ledger Design Proposal

Status: **proposal only; no schema or live-money behavior is authorized by this document.** The current source audit found that withdrawal reserve/release movements are not represented as explicit rows in `wallet_transactions`. Design the ledger before enabling client deposits, project budgets or real payouts.

## Goals

- Keep client funds separate from freelancer earnings and platform revenue.
- Make every movement traceable, idempotent, auditable and reconcilable.
- Keep monetary values in integer cents with an explicit currency (USD initially, if the founder confirms).
- Never trust browser-reported payment success or allow the client to directly change a balance.
- Preserve historical records; correct mistakes with compensating entries rather than editing old ledger rows.

## Proposed account buckets

| Bucket | Meaning |
|---|---|
| Client available | Confirmed client funds not yet allocated to a project |
| Client project-reserved | Funds committed to a reviewed/published project but not yet earned by contributors |
| Freelancer available | Approved earnings available for withdrawal |
| Freelancer withdrawal-reserved | Funds reserved for a pending payout request |
| Provider clearing | Funds in transit or awaiting reconciliation with a payment provider |
| Platform fee revenue | Explicitly recognized platform fees, separate from worker/client funds |
| Refund/chargeback clearing | Reversals and disputes awaiting final resolution |

These are accounting concepts, not committed table names. The final schema should use append-only journal entries (preferably balanced double-entry transactions) and may retain `wallets` as a cached balance projection.

## Lifecycle proposals

### 1. Client deposits

1. Client chooses a deposit amount and an enabled provider.
2. Server creates a pending deposit record with a unique internal ID and idempotency key.
3. Client completes provider checkout.
4. A verified server-to-server webhook (or trusted provider verification call) confirms the payment; the browser redirect alone never confirms funds.
5. In one database transaction, mark the provider event idempotently and post balanced ledger entries into client available funds.
6. Store provider transaction IDs, amount, currency, timestamps and reconciliation status; never store card credentials or provider secrets in browser code.

A duplicate webhook must not credit twice. Failed, cancelled, expired and chargeback events must have explicit states and audit history.

### 2. Draft, review and project funding

1. Creating/editing a draft does not charge or reserve money.
2. Server-side moderation validates the project, reward, capacity, instructions, data/privacy risk and prohibited work.
3. Before publication, the client confirms the project budget and the server checks sufficient confirmed client funds.
4. In one transaction, move the approved budget from client available to project-reserved; publish only if reservation succeeds.
5. Record the budget, remaining amount, per-worker reward, capacity and fee policy as a versioned snapshot so later edits cannot silently change an active commitment.

### 3. Contributor approval and project completion

- A submission approval must be idempotent and guarded by a locked pending/reviewable status.
- Move the correct amount from project-reserved into the freelancer's available earnings and recognize platform fees only according to a founder-approved gross/net policy.
- Rejected or resubmitted work must not issue earnings.
- When a project ends, release only the unused, eligible reserved balance according to the agreed refund/cancellation policy.
- A client cannot approve their own moderation actions or alter the worker payout amount after work begins.

### 4. Freelancer withdrawals

1. Check KYC, suspension/withdrawal hold, available balance, configured minimum, provider/method eligibility and destination requirements server-side.
2. Move the gross requested amount from freelancer available to withdrawal-reserved exactly once.
3. A rejection/cancellation releases the exact reserve once. If the reserve is inconsistent, fail closed and create a reconciliation case instead of silently releasing a partial amount.
4. Approval moves reserved funds into a payout-in-transit state and posts net payout plus fee entries that satisfy the documented gross/net equation.
5. Finalize on verified provider payout success. If payout fails, reverse via compensating entries under a documented retry policy.
6. A repeated RPC or webhook must not double-reserve, double-pay, double-release or double-charge a fee.

The exact payout provider and whether it supports the desired Kenyan/global payout methods must be confirmed separately. Do not assume a deposit gateway automatically supports payouts.

## Ledger invariants

- Every journal transaction balances: total debits equal total credits.
- Available and reserved balances never become negative.
- Each external provider event and each internal lifecycle transition has a unique idempotency key.
- Provider amount, currency, internal amount and expected state must match before posting.
- Client funds never appear in a freelancer balance until the approved earning transition.
- A draft project never reserves funds.
- No browser/client direct write can alter balances or post ledger entries.
- Corrections are compensating entries with actor, reason, linked original transaction and audit trail.
- Periodic reconciliation compares provider statements, pending deposits, clearing accounts, project reserves, freelancer liabilities, withdrawal requests and cached wallet balances.
- Fee rate, minimum withdrawal, amount increment, refund policy and gross/net interpretation are versioned and auditable.

## Founder decisions required before implementation

- Confirm the ledger's currency model and whether USD remains the initial settlement currency.
- Confirm the client deposit provider and the separate payout provider(s); Flutterwave is the intended first integration, with Paystack as a possible future option, but actual product support must be verified.
- Confirm deposit minimums, fees, refund/chargeback policy and when a deposit becomes spendable.
- Confirm whether a project budget includes worker rewards only or also a platform fee.
- Confirm whether displayed worker rewards are gross or net and how fees are charged.
- Confirm withdrawal fee, minimum, increment, KYC threshold, payout SLA and failed-payout retry policy.
- Confirm who can authorize project publication, refunds, manual ledger adjustments and disputed withdrawals.

## Required isolated tests

- Duplicate, delayed, out-of-order and invalid-signature webhooks.
- Deposit pending/success/failure/cancel/refund/chargeback.
- Concurrent project publication attempts against the same client balance.
- Concurrent submissions at capacity and duplicate approval attempts.
- Concurrent withdrawal requests against one available balance.
- Withdrawal rejection with exact reserve, insufficient reserve, duplicate rejection and optional hold.
- Provider payout success/failure/retry and reconciliation mismatch.
- Ledger totals and cached balance projection after every lifecycle transition.
- Cross-client isolation, staff permission denial, audit trail and rollback on any failed transaction.

No live payment credentials, real deposits, production balance changes or historical ledger rewrites should occur until this design is reviewed, the fee/refund policy is confirmed, and the full isolated test suite passes.
