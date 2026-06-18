# PostMaker Deployment Readiness

Current date: 2026-06-18

This file is the practical deployment map for this repository. It explains what currently works, what keys are needed, where to put them, and what must be verified before calling the product production-ready.

## Current State

The project now runs locally as a real app:

- Frontend: React + Vite
- Backend/API: Cloudflare Worker
- Database: Cloudflare D1
- Local login: `/api/auth/dev` creates a development-only admin/business user
- Local D1 migrations: working
- TypeScript checks: passing
- Frontend production build: passing
- Production dependency audit: clean for root, Worker, and frontend

Important fixes already made:

- Local app login no longer bounces back to the landing page.
- Main page and app scrolling now work.
- D1 migration path is configured correctly.
- D1 initial migration is Wrangler-compatible SQL.
- Worker assets are configured for SPA fallback.
- API routes are configured to run Worker-first.
- GitHub Actions deploy now runs from the repo root, where `wrangler.toml` actually lives.
- Wrangler is pinned to `4.40.0`, which supports SPA asset routing and still works on Node 20.
- Razorpay plan IDs are now environment-driven instead of hardcoded fake IDs.
- Production/staging D1 migrations explicitly use `--remote`.

## Is This Production Ready?

Short answer: deployable, but not yet proven production-ready.

The codebase is close enough to deploy to a real staging environment. It is not honest to call it fully production-ready until these flows are tested against real remote services:

- Google OAuth sign-in on the real domain.
- AI generation with real Groq and Gemini keys.
- Razorpay subscription checkout in test mode, then live mode.
- Razorpay webhook events updating user plans in D1.
- Resend transactional emails.
- Admin user promotion.
- Account deletion flow.
- Cron retention and usage reset jobs.
- Deep links such as `/app`, `/settings`, `/admin`.

Known launch caveats:

- Promo codes currently validate and show discounted UI prices, but Razorpay billing is still tied to the selected Razorpay plan. Real billing discounts need Razorpay Offers or separate discounted plan IDs.
- There are no automated end-to-end tests for auth, generation, checkout, webhook, and account deletion.
- Domain binding is not encoded in `wrangler.toml`; it must be configured in Cloudflare unless routes/custom domains are added.
- The README claimed "production-ready"; the safer truth is "staging-ready after secrets and Cloudflare resources are configured."

## Local Keys

For local development, put keys in the root file:

```bash
.dev.vars
```

Create it from:

```bash
cp .dev.vars.example .dev.vars
```

Minimum local keys to test AI generation:

```bash
GROQ_API_KEY=
GEMINI_API_KEY=
JWT_SECRET=
```

Local login does not need Google OAuth. Open:

```text
http://localhost:5173/api/auth/dev
```

After changing `.dev.vars`, restart:

```bash
npm run dev
```

## Cloudflare Resources Needed

Create three D1 databases:

```bash
./worker/node_modules/.bin/wrangler d1 create postmaker-db-dev
./worker/node_modules/.bin/wrangler d1 create postmaker-db-staging
./worker/node_modules/.bin/wrangler d1 create postmaker-db
```

Paste the returned database IDs into `wrangler.toml`:

```toml
REPLACE_WITH_DEV_D1_ID
REPLACE_WITH_STAGING_D1_ID
REPLACE_WITH_YOUR_D1_ID
```

Run remote migrations after the IDs are set:

```bash
npm run db:migrate:staging --prefix worker
npm run db:migrate:prod --prefix worker
```

Cloudflare D1 docs separate local and remote migration targets; `--remote` is required for deployed D1 databases.

## Worker Secrets

Set these in Cloudflare Workers for both staging and production.

Production example:

```bash
./worker/node_modules/.bin/wrangler secret put GROQ_API_KEY --env production
./worker/node_modules/.bin/wrangler secret put GEMINI_API_KEY --env production
./worker/node_modules/.bin/wrangler secret put RAZORPAY_KEY_ID --env production
./worker/node_modules/.bin/wrangler secret put RAZORPAY_KEY_SECRET --env production
./worker/node_modules/.bin/wrangler secret put RAZORPAY_WEBHOOK_SECRET --env production
./worker/node_modules/.bin/wrangler secret put RAZORPAY_PLAN_STARTER_USD --env production
./worker/node_modules/.bin/wrangler secret put RAZORPAY_PLAN_STARTER_INR --env production
./worker/node_modules/.bin/wrangler secret put RAZORPAY_PLAN_PRO_USD --env production
./worker/node_modules/.bin/wrangler secret put RAZORPAY_PLAN_PRO_INR --env production
./worker/node_modules/.bin/wrangler secret put RAZORPAY_PLAN_BUSINESS_USD --env production
./worker/node_modules/.bin/wrangler secret put RAZORPAY_PLAN_BUSINESS_INR --env production
./worker/node_modules/.bin/wrangler secret put RESEND_API_KEY --env production
./worker/node_modules/.bin/wrangler secret put GOOGLE_CLIENT_ID --env production
./worker/node_modules/.bin/wrangler secret put GOOGLE_CLIENT_SECRET --env production
./worker/node_modules/.bin/wrangler secret put JWT_SECRET --env production
```

Repeat for staging with `--env staging`.

Plan IDs are not truly secret, but storing them with Worker secrets is simple and keeps environment setup consistent.

## Key Sources

AI:

- `GROQ_API_KEY`: Groq Console
- `GEMINI_API_KEY`: Google AI Studio

Google OAuth:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Razorpay:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- six real Razorpay plan IDs, usually shaped like `plan_...`

Resend:

- `RESEND_API_KEY`

Auth:

- `JWT_SECRET`: generate a long random string, 64+ characters.

Example:

```bash
openssl rand -hex 32
```

## Google OAuth Setup

Create a Google OAuth Web Client.

Authorized JavaScript origins:

```text
http://localhost:5173
https://staging.bypostmaker.com
https://bypostmaker.com
```

Authorized redirect URIs:

```text
http://localhost:8787/api/auth/callback
https://api.staging.bypostmaker.com/api/auth/callback
https://api.bypostmaker.com/api/auth/callback
```

The backend currently builds non-dev callback URLs as:

```text
https://api.${DOMAIN}/api/auth/callback
```

So if `DOMAIN = bypostmaker.com`, the callback is:

```text
https://api.bypostmaker.com/api/auth/callback
```

## Razorpay Setup

Create six subscription plans in Razorpay and copy the real generated plan IDs:

```text
RAZORPAY_PLAN_STARTER_USD
RAZORPAY_PLAN_STARTER_INR
RAZORPAY_PLAN_PRO_USD
RAZORPAY_PLAN_PRO_INR
RAZORPAY_PLAN_BUSINESS_USD
RAZORPAY_PLAN_BUSINESS_INR
```

Use these prices:

```text
Starter USD:   9 USD monthly
Starter INR:   749 INR monthly
Pro USD:       19 USD monthly
Pro INR:       1499 INR monthly
Business USD:  49 USD monthly
Business INR:  3999 INR monthly
```

Razorpay subscription creation uses `plan_id`; Razorpay docs show this as a generated ID such as `plan_00000000000001`, so do not rely on fake IDs like `plan_starter_usd`.

Webhook URL:

```text
https://bypostmaker.com/api/webhooks/razorpay
```

Webhook events:

```text
subscription.activated
subscription.charged
subscription.cancelled
subscription.halted
```

## Frontend Build Variables

These are Vite build-time variables. They do not go into Worker secrets.

For local production builds, put them in:

```bash
frontend/.env.production
```

For GitHub Actions, put them in GitHub repository Secrets/Variables:

```text
VITE_SENTRY_DSN      GitHub secret
VITE_POSTHOG_KEY     GitHub secret
VITE_POSTHOG_HOST    GitHub variable, default: https://app.posthog.com
```

They are optional for core app behavior, but required if you want production monitoring and analytics.

## GitHub Actions Secrets

Required for CI/CD deploy:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

Optional frontend build secrets:

```text
VITE_SENTRY_DSN
VITE_POSTHOG_KEY
```

Optional GitHub variable:

```text
VITE_POSTHOG_HOST=https://app.posthog.com
```

The Cloudflare API token needs permission to deploy Workers, upload assets, read/write D1 migrations, and read account resources.

## Domain Setup

At minimum, configure these hostnames in Cloudflare:

Production:

```text
bypostmaker.com
api.bypostmaker.com
```

Staging:

```text
staging.bypostmaker.com
api.staging.bypostmaker.com
```

Both app and API can point to the same Worker. The frontend uses same-origin `/api/...` calls, while Google OAuth callback currently uses the `api.` subdomain.

## Deployment Commands

First install and check:

```bash
npm install
npm install --prefix worker
npm install --prefix frontend
npm run type-check
npm run build
```

Manual staging deploy:

```bash
npm run build
npm run db:migrate:staging --prefix worker
./worker/node_modules/.bin/wrangler deploy --env staging
```

Manual production deploy:

```bash
npm run build
npm run db:migrate:prod --prefix worker
./worker/node_modules/.bin/wrangler deploy --env production
```

Automatic deploy:

```text
push to staging branch -> deploy staging
push to main branch    -> deploy production
```

## First Admin User

After real Google login creates your user:

```bash
./worker/node_modules/.bin/wrangler d1 execute postmaker-db --env production --remote \
  --command "UPDATE users SET role = 'admin' WHERE email = 'your@email.com'"
```

Then visit:

```text
https://bypostmaker.com/admin
```

## Final Production Acceptance Checklist

Do not call this production-ready until every item below is checked in staging first, then production:

- `/api/health` returns `status: ok`.
- Landing page loads from the real domain.
- `/app` deep link loads after refresh.
- Google OAuth login works.
- Session cookie is set and survives refresh.
- AI generation returns posts for selected platforms.
- AI fallback works when Groq fails or rate-limits.
- ZIP download works with text-only generation.
- ZIP download works with image upload.
- Video upload guard rejects over-limit files.
- Razorpay test subscription opens Checkout.
- Razorpay test webhook upgrades the user plan.
- Razorpay cancel path updates subscription state.
- Resend emails are delivered.
- Admin page can list users and edit roles.
- Promo code creation and validation work.
- Account deletion deletes user data and clears session.
- Cron jobs run without errors.
- Sentry receives a test error.
- PostHog receives a test event.

## Bottom Line

This repo is now in a staging-ready state once real Cloudflare resources and keys are added.

It is not yet honestly "final production-ready" until staging proves the full external-service loop: OAuth, AI, payments, webhooks, emails, admin, and account deletion.

Useful official docs:

- Cloudflare Workers static assets SPA routing: https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/
- Cloudflare Wrangler assets config: https://developers.cloudflare.com/workers/wrangler/configuration/
- Cloudflare D1 Wrangler commands: https://developers.cloudflare.com/d1/wrangler-commands/
- Razorpay create subscription API: https://razorpay.com/docs/api/payments/subscriptions/create-subscription/
