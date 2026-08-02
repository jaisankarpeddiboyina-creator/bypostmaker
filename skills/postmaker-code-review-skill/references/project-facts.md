# PostMaker — Project Facts

## Identity
- Repo: `https://github.com/jaisankarpeddiboyina-creator/bypostmaker.git`
- Branches: `main` (production), `staging` (staging)
- What it is: users upload a prompt and/or a photo, select one or more
  social platforms, get platform-specific captions generated.
- Stack: Cloudflare Worker backend (`worker/`), D1 (SQLite) (`db/`), R2
  object storage, React + Vite frontend (`frontend/`), Razorpay (INR)
  payments, Gemini (vision, free tier, rate-limited) + Groq (fast text).

## Architecture map
- `worker/src/routes/generate.ts` — main generation endpoint; orchestrates
  Stage 1 (Gemini vision, once) and Stage 2 (Groq per-platform, parallel).
- `worker/src/routes/retry.ts` — per-platform retry; reuses cached image
  description when available (`campaigns.image_description`).
- `worker/src/routes/payments.ts` — subscription upgrade/checkout init.
- `worker/src/routes/webhook.ts` — Razorpay webhook handler; the **only**
  place that should mutate `users.plan` from subscription events.
- `worker/src/routes/upload.ts` — R2 presigned upload URL issuance.
- `config/ai.ts` — provider selection, `analyzeImage()` (Stage 1),
  `streamGenerate()`/`createStreamingClient()` (Stage 2), timeouts.
- `db/schema.sql` — reference schema (not live DDL). `db/migrations/*.sql`
  — actual applied migrations.
- `frontend/src/pages/AppPage.tsx` — generate UI, SSE handling.
- `frontend/src/components/PostCard.tsx` — per-platform card, retry button.
- `frontend/src/store/app.ts` — Zustand store.
- `.github/workflows/deploy.yml` — CI: typecheck gate, then deploy.

## Environments & deploy triggers

| Environment | Deploy trigger | Domain | D1 DB | R2 bucket |
|---|---|---|---|---|
| Production | push to `main` | bypostamaker.com | `postmaker-db` | `postmaker-uploads` |
| Staging | push to `staging` | staging.bypostamaker.com | `postmaker-db-staging` | `postmaker-uploads-staging` |

- Pushing/merging to `main` **only** deploys production, never staging.
- To also update staging with the same commit: `git push origin main:staging`
- Both gated by a `typecheck` job in CI — **always also verify locally**
  with `npm run type-check`, don't trust CI or "my editor shows no errors."
- Manual deploy (only when explicitly instructed, bypasses git):
  `npm run deploy:staging` / `npm run deploy` (root scripts prefix into
  `worker/`; underlying commands are `wrangler deploy --env <env>`).
- Staging has its own separate D1 database and R2 bucket (see table above)
  — it does **not** contain a copy of production data. A staging account
  showing "0 campaigns" / empty history is expected for any account that
  hasn't generated anything on staging specifically — it is not a
  regression or a sign the deploy broke something. To verify a feature on
  staging, generate fresh test data there first; don't expect existing
  production history to appear.

## Standing facts — don't re-discover these every session
- `GEMINI_API_KEY` is free-tier — strict rate limits. Any test with real
  Gemini calls must be minimal, deliberate, and its budget stated up front.
  Prefer mocks unless a real call is specifically required.
- `VISION_MODEL` / `GEMINI_API_KEY` are Wrangler **secrets**, not `vars` in
  `wrangler.toml` — check with `wrangler secret list --env <env>`; values
  can't be read back, only presence/absence confirmed.
- Vision pipeline is **two-stage**: Gemini analyzes the image exactly once
  per generation request regardless of platform count, producing a text
  description; Groq then writes captions per platform group in parallel
  from that description. Never regress this back into "one Gemini call per
  platform group" — that was the original production bug.
- `campaigns.image_description` (TEXT, nullable) caches the Stage 1 output
  for retry reuse — avoids a redundant Gemini call on retry.
- Cloudflare Workers have a ~30s wall-clock subrequest limit — any timeout
  design must keep combined worst-case latency safely under this, with
  margin, not "just barely under."
- Never modify or log into an existing real production user account for
  testing, even temporarily with a planned restore. Always create a fresh
  disposable test account instead.
- Subscription upgrades must never cancel/downgrade the user's existing
  paid plan until the new plan is confirmed **activated** by a webhook —
  never at checkout-initiation time. This was a real billing bug; don't
  reintroduce the "optimistic cancel before confirmation" pattern anywhere.
