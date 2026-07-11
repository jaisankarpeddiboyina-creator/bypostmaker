# bypostmaker

Enterprise-grade social media post generation SaaS built on Cloudflare Workers, D1, and React.

## Badges

[![Status](https://img.shields.io/badge/status-production-green)](https://github.com/your-org/bypostmaker)
[![Node.js](https://img.shields.io/badge/node-20+-brightgreen)](https://nodejs.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-blue)](https://workers.cloudflare.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue)](https://www.typescriptlang.org/)


## Quick start

```bash
npm install
npm install --prefix worker
npm install --prefix frontend
cp .dev.vars.example .dev.vars
npm run db:migrate:dev --prefix worker
npm run dev
```

Open `http://localhost:5173`.

## Overview

`bypostmaker` is a production-ready platform for AI-assisted social media content creation, subscription management, and administration.

Core capabilities:

- Multi-platform AI content generation
- Razorpay subscription billing and promo workflows
- Google OAuth authentication with role-based access
- Admin dashboard for metrics, user management, and promotions
- Transactional email delivery via Resend
- Analytics with PostHog and error monitoring with Sentry

## Technology stack

- Frontend: React 18, Vite, TypeScript, Zustand
- Backend: Cloudflare Workers, Wrangler, TypeScript
- Database: Cloudflare D1 with migration support
- AI: `@ailink/sdk` with Groq primary and Gemini fallback
- Payments: Razorpay subscriptions
- Email: Resend
- Monitoring: PostHog and Sentry

## Repository layout

```text
bypostmaker/
├── config/
│   ├── ai.ts
│   ├── limits.ts
│   └── platforms.ts
├── db/
│   ├── schema.sql
│   └── migrations/
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── components/
│       ├── lib/
│       ├── pages/
│       ├── store/
│       └── styles/
├── worker/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── middleware/
│       ├── routes/
│       └── services/
├── wrangler.toml
├── .dev.vars.example
└── README.md
```

## Prerequisites

- Node.js 20+
- Cloudflare account
- Wrangler CLI installed
- Razorpay account
- Resend account
- Google Cloud OAuth credentials
- PostHog account
- Sentry account

## Setup

Install dependencies:

```bash
npm install
npm install --prefix worker
npm install --prefix frontend
```

Create the local environment file:

```bash
cp .dev.vars.example .dev.vars
```

Populate `.dev.vars` with local secrets.

## Local development

Apply local migrations:

```bash
npm run db:migrate:dev --prefix worker
```

Start the application:

```bash
npm run dev
```

Open the browser at:

```text
http://localhost:5173
```

To run the backend and frontend separately:

```bash
cd worker && npm run dev
cd frontend && npm run dev
```

### Local development notes

- A development-only login route is available at `/api/auth/dev`
- AI generation requires `GROQ_API_KEY` and `GEMINI_API_KEY`
- Google OAuth requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `JWT_SECRET`
- Local Google OAuth callback URL:

```text
http://localhost:8787/api/auth/callback
```

## Environment configuration

### Local

Use `.dev.vars` for development-only secrets.

### Production

From the `worker/` directory, configure Cloudflare secrets:

```bash
wrangler secret put GROQ_API_KEY
wrangler secret put GEMINI_API_KEY
wrangler secret put RAZORPAY_KEY_ID
wrangler secret put RAZORPAY_KEY_SECRET
wrangler secret put RAZORPAY_WEBHOOK_SECRET
wrangler secret put RAZORPAY_PLAN_STARTER_USD
wrangler secret put RAZORPAY_PLAN_STARTER_INR
wrangler secret put RAZORPAY_PLAN_PRO_USD
wrangler secret put RAZORPAY_PLAN_PRO_INR
wrangler secret put RAZORPAY_PLAN_BUSINESS_USD
wrangler secret put RAZORPAY_PLAN_BUSINESS_INR
wrangler secret put RESEND_API_KEY
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put JWT_SECRET
```

### Frontend production variables

Create `frontend/.env.production`:

```bash
VITE_SENTRY_DSN=https://<key>@<host>.ingest.sentry.io/<id>
VITE_POSTHOG_KEY=phc_xxxxxxxxxxxx
VITE_POSTHOG_HOST=https://app.posthog.com
```

## Wrangler environments

Configured environments:

- `development`
- `staging`
- `production`

Each environment uses separate D1 databases and R2 buckets.

## Scripts

### Root scripts

- `npm run dev` — start worker and frontend together
- `npm run build` — build frontend assets
- `npm run deploy` — build frontend and deploy production worker
- `npm run deploy:staging` — build frontend and deploy staging worker
- `npm run db:migrate` — run production migrations via worker
- `npm run type-check` — type-check worker and frontend

### Worker scripts

- `npm run dev` — `wrangler dev --env development`
- `npm run deploy:staging` — `wrangler deploy --env staging`
- `npm run deploy:production` — `wrangler deploy --env production`
- `npm run db:migrate:dev` — apply development migrations locally
- `npm run db:migrate:staging` — apply staging migrations remotely
- `npm run db:migrate:prod` — apply production migrations remotely
- `npm run type-check` — `tsc --noEmit`

### Frontend scripts

- `npm run dev` — start Vite development server
- `npm run build` — build production assets
- `npm run preview` — preview production build
- `npm run type-check` — `tsc --noEmit`

## Deployment

Authenticate with Cloudflare:

```bash
wrangler login
```

Deploy staging:

```bash
npm run deploy:staging --prefix worker
```

Deploy production:

```bash
npm run deploy:production --prefix worker
```

## Contributing

- Fork the repository and create a feature branch from `main`
- Use branch names such as `feature/<name>` or `fix/<name>`
- Keep changes small and focused
- Add a concise summary to the pull request
- Run `npm run type-check` in both root and subpackages before submitting
- Update `README.md` when you add new setup steps, environment variables, or workflows

## Project structure

```text
bypostmaker/
├── config/
│   ├── platforms.ts          ← all platform definitions and metadata
│   └── ai.ts                 ← AI generation setup, sessions, and streaming
├── db/
│   ├── schema.sql            ← database schema definitions
│   └── migrations/           ← D1 migration files
├── worker/src/
│   ├── index.ts              ← worker entry point
│   ├── middleware/           ← auth, CORS, and rate limiting
│   ├── routes/               ← API route handlers
│   └── services/             ← email, usage, cron, and utility services
├── frontend/src/
│   ├── components/           ← reusable UI components
│   ├── pages/                ← page views and route screens
│   ├── store/                ← Zustand application state
│   └── lib/                  ← API client, monitoring, and utilities
├── wrangler.toml             ← environment configuration
└── .github/workflows/        ← CI/CD workflows
```

## Included functionality

- Google OAuth authentication with secure cookies
- Multi-platform AI post generation
- SSE-based generation updates
- Razorpay subscription billing with USD/INR plans
- Promo code support with usage limits and expiry
- Admin dashboard for users, promotions, and metrics
- Beta and admin role management
- Campaign history and re-use workflow
- Usage limits and plan-based retention rules
- Transactional emails via Resend
- PostHog analytics and Sentry error monitoring
- SEO-friendly pages and OG metadata
- Dedicated development, staging, and production environments
