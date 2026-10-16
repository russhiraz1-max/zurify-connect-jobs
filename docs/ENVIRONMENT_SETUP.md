# Zurify 2.0 environment setup

This branch intentionally contains placeholders only. Do not copy a real production secret into GitHub, chat, a browser-visible variable, or this file.

## What belongs where

| Variable | Purpose | Where it belongs | Required now? |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Browser's Supabase project URL | Vercel environment for the dedicated 2.0 project | Yes, when configuring a preview |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public/publishable client key | Vercel environment for the dedicated 2.0 project | Yes, when configuring a preview |
| `SUPABASE_URL` | Server/Edge Function project URL | Server environment or Supabase Edge Function configuration | Only when server endpoints are added |
| `SUPABASE_SERVICE_ROLE_KEY` | Elevated server-only database access | Prefer Supabase managed runtime; otherwise a protected server secret store | **Do not set for the frontend. Never use in `VITE_*`.** |
| `RESEND_API_KEY` | Transactional email API | Supabase Edge Function secrets or a protected server runtime | Not yet; email sender integration must be implemented and tested |
| `RESEND_FROM_EMAIL` | Verified sender address | Server environment / Edge Function secret/config | Not yet; verify the domain first |
| `FLUTTERWAVE_PUBLIC_KEY` | Checkout identifier, if required by the eventual integration | Server configuration initially; only expose if a reviewed checkout design explicitly requires it | Not yet |
| `FLUTTERWAVE_SECRET_KEY` | Flutterwave API authorization | Server/Edge Function secret store only | Not yet |
| `FLUTTERWAVE_ENCRYPTION_KEY` | Provider-specific encryption use, if needed | Server/Edge Function secret store only | Not yet |
| `FLUTTERWAVE_WEBHOOK_HASH` | Verify the configured webhook signature/header | Server/Edge Function secret store only | Not yet |
| `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET` | Future separate Paystack adapter | Server/Edge Function secret store only | No; Paystack is not implemented |

## Safe order of setup

1. Create a separate Supabase project for Zurify 2.0. Do not use the current production project ref from the existing app by default.
2. Configure only the new project's URL and publishable key in a preview environment.
3. Apply migrations to a disposable/local database first. The latest AI-company and admin-configuration migrations must pass CI before you use them in any hosted 2.0 database.
4. Add Resend credentials only after the sender domain is verified and the transactional-email integration is implemented.
5. Add Flutterwave sandbox credentials only after server-side checkout and webhook functions are implemented. Keep the provider preference set to `disabled` until sandbox verification, idempotency and reconciliation tests pass.
6. Never enable live transactions by changing a feature flag alone. The database currently hard-disables payment activation.

## Important distinction

The `.env.example` file is documentation with dummy values. It does not mean a backend integration is active. **You do not need to paste payment or Resend keys into any file yet.** When those server-side integrations are ready, put their values into the dedicated 2.0 project's protected server/Edge Function secrets—not into the frontend `.env`, not into a `VITE_*` variable, and not into this repository.
