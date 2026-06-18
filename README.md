# PostMaker — Deployment Guide

Complete, production-ready. Zero v1/v2 iterations needed.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Zustand + Tailwind tokens |
| Backend | Cloudflare Workers (TypeScript) |
| Database | Cloudflare D1 (SQLite) |
| AI | @ailink/sdk → Groq (primary) → Gemini (fallback) |
| Image Resize | @cf-wasm/photon (free, WASM, runs in Workers) |
| Payments | Razorpay (subscriptions, INR + USD) |
| Email | Resend |
| Analytics | PostHog (free tier) |
| Error Monitoring | Sentry (free tier) |
| CI/CD | GitHub Actions |

---

## Prerequisites

- Node.js 20+
- Cloudflare account (free)
- Razorpay account (international payments enabled)
- Resend account (free tier: 3,000 emails/month)
- Google Cloud Console project (OAuth)
- PostHog account (free tier)
- Sentry account (free tier)
- Domain: bypostmaker.com (or your chosen domain)

---

## Step 1 — Install

```bash
git clone <your-repo>
cd bypostmaker
npm install
npm install --prefix worker
npm install --prefix frontend
```

---

## Step 2 — Cloudflare Setup

```bash
wrangler login

# Create databases
wrangler d1 create postmaker-db           # production
wrangler d1 create postmaker-db-dev       # dev
wrangler d1 create postmaker-db-staging   # staging

# Paste the returned database IDs into wrangler.toml
# Replace all REPLACE_WITH_*_D1_ID placeholders
```

---

## Step 3 — Run Migrations

```bash
cd worker
npm run db:migrate:dev      # development
npm run db:migrate:staging  # staging
npm run db:migrate:prod     # production
```

---

## Step 4 — Set Secrets

```bash
cd worker

wrangler secret put GROQ_API_KEY            # console.groq.com
wrangler secret put GEMINI_API_KEY          # aistudio.google.com
wrangler secret put RAZORPAY_KEY_ID
wrangler secret put RAZORPAY_KEY_SECRET
wrangler secret put RAZORPAY_WEBHOOK_SECRET
wrangler secret put RESEND_API_KEY
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put JWT_SECRET              # any 64-char random string
```

---

## Step 5 — Frontend Environment Variables

Create `frontend/.env.production`:

```
VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
VITE_POSTHOG_KEY=phc_xxxxxxxxxxxx
VITE_POSTHOG_HOST=https://app.posthog.com
```

Create `frontend/.env.development` (analytics disabled in dev automatically):
```
# No vars needed for dev
```

---

## Step 6 — Google OAuth

1. console.cloud.google.com → Create OAuth 2.0 credentials
2. Authorized redirect URIs:
   - `http://localhost:8787/api/auth/callback` (dev)
   - `https://api.bypostmaker.com/api/auth/callback` (production)

---

## Step 7 — Razorpay Plans

Create exactly these 6 plans in the Razorpay dashboard (Plans → Create):

| ID | Amount | Interval |
|---|---|---|
| `plan_starter_usd` | $9 USD | Monthly |
| `plan_starter_inr` | ₹749 INR | Monthly |
| `plan_pro_usd` | $19 USD | Monthly |
| `plan_pro_inr` | ₹1,499 INR | Monthly |
| `plan_business_usd` | $49 USD | Monthly |
| `plan_business_inr` | ₹3,999 INR | Monthly |

Webhook URL: `https://bypostmaker.com/api/webhooks/razorpay`
Events to subscribe: `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `subscription.halted`

---

## Step 8 — GitHub Actions Secrets

In GitHub repo → Settings → Secrets → Actions:

```
CLOUDFLARE_API_TOKEN    (from CF → My Profile → API Tokens)
CLOUDFLARE_ACCOUNT_ID   (from CF dashboard sidebar)
```

Push to `staging` branch → auto-deploys staging  
Push to `main` branch → auto-deploys production

---

## Step 9 — First Admin User

After deploying and signing in with your account:

```bash
# In Cloudflare D1 console or via wrangler:
wrangler d1 execute postmaker-db --env production \
  --command "UPDATE users SET role = 'admin' WHERE email = 'your@email.com'"
```

Then visit `bypostmaker.com/admin` to manage users, promos, and view stats.

---

## Step 10 — Create Beta Users

In the admin dashboard → Users tab → find user → set Role to `beta`.
Beta users get Business-tier access for free automatically.

---

## Step 11 — Create Promo Codes

In the admin dashboard → Promos tab → fill in code, discount %, optional max uses.
Users apply codes in the upgrade modal before checkout.

---

## Local Development

```bash
# Install dependencies
npm install
npm install --prefix worker
npm install --prefix frontend

# Create the local D1 database schema
npm run db:migrate:dev --prefix worker

# Optional: required for Google sign-in, AI generation, payments, and email
cp .dev.vars.example .dev.vars
# Fill in the values in .dev.vars

# Run Worker and frontend together
npm run dev
```

Open `http://localhost:5173`.

In local development, the landing page uses a development-only login at `/api/auth/dev`
so you can enter the app without configuring Google OAuth first. This creates a local
admin/business demo user in D1. Production and staging still use Google OAuth.

AI generation requires these two values in the root `.dev.vars` file:

```bash
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
```

After changing `.dev.vars`, stop and restart `npm run dev`.

To test real Google login locally, create a Google OAuth client and set:

```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
JWT_SECRET=any-long-random-string
```

The Google OAuth authorized redirect URI must be:

```text
http://localhost:8787/api/auth/callback
```

```bash
# Or run them separately
cd worker && npm run dev      # Worker: http://localhost:8787
cd frontend && npm run dev    # Frontend: http://localhost:5173
```

---

## Project Structure

```
bypostmaker/
├── config/
│   ├── platforms.ts          ← All 33 platforms — single source of truth
│   └── ai.ts                 ← @ailink/sdk setup, streaming, sessions
├── db/
│   ├── schema.sql            ← All tables + indexes
│   └── migrations/
├── worker/src/
│   ├── index.ts              ← Router entry point
│   ├── middleware/           ← Auth, CORS, rate limiting
│   ├── routes/               ← All API endpoints
│   └── services/             ← Email, usage, cron
├── frontend/src/
│   ├── components/           ← UI components
│   ├── pages/                ← App, Landing, History, Settings, Admin, Legal
│   ├── store/                ← Zustand state
│   └── lib/                  ← API client, monitoring
├── wrangler.toml             ← Dev/Staging/Production config
└── .github/workflows/        ← CI/CD
```

---

## What's Included

- ✅ Google OAuth (httpOnly cookie sessions)
- ✅ 33 platform config with tones, dimensions, share URLs
- ✅ SSE streaming — cards fill in real time
- ✅ 8 parallel AI group calls (@ailink/sdk + Groq + Gemini fallback)
- ✅ Per-platform AI refinement chat (isolated sessions)
- ✅ Inline card editing + copy button + individual kit download
- ✅ Reddit subreddit / HN URL fields inside platform cards
- ✅ @cf-wasm/photon image resizing (free, WASM, in Workers)
- ✅ Video at ZIP root (100MB limit, guard at 80MB)
- ✅ Razorpay subscriptions (USD + INR, 3 plans)
- ✅ Promo codes with discount %, max uses, expiry
- ✅ Admin dashboard — stats, user management, promo CRUD
- ✅ Beta/admin role system
- ✅ Campaign history with re-use prompt
- ✅ Usage limits per plan + 80%/100% email alerts
- ✅ Data retention by plan (7/30/90/365 days)
- ✅ Account deletion (cancels Razorpay + deletes all data atomically)
- ✅ 7 transactional emails (Resend)
- ✅ PostHog analytics + Sentry error monitoring
- ✅ Full SEO + OG image + structured data
- ✅ Legal pages (Privacy, Terms, Refund, Cookies)
- ✅ 3 environments (dev/staging/production)
- ✅ GitHub Actions CI/CD
- ✅ Platform config versioning (version field in platforms.ts)
