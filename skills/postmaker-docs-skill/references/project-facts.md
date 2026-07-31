# PostMaker — Project Facts & Invariants

## Identity & Core Repository Context
- Repo: `https://github.com/jaisankarpeddiboyina-creator/bypostmaker.git`
- Branches: `main` (production), `staging` (staging)
- What it is: Live production SaaS generating platform-tailored social media content across 30+ platforms from a single prompt.
- Stack: Cloudflare Worker backend (`worker/`), D1 SQLite database (`db/`), R2 object storage, React + Vite frontend (`frontend/`), Razorpay recurring payments, Gemini (vision) + Groq (fast text).

## Architecture Map
- `worker/src/routes/generate.ts` — Main post generation endpoint; orchestrates Stage 1 (Gemini vision, once) and Stage 2 (Groq per-platform text, parallel).
- `worker/src/routes/retry.ts` — Per-platform retry handler reusing stored `campaigns.image_description`.
- `worker/src/routes/payments.ts` — Subscription checkout & status endpoint.
- `worker/src/routes/webhook.ts` — Razorpay webhook handler; ONLY place authorized to mutate `users.plan` from payment events.
- `worker/src/routes/upload.ts` — Presigned S3 upload URL issuer for R2 storage bucket.
- `worker/src/routes/brand-kit.ts` — Brand Kit manager REST routes and owner-verified logo R2 asset streamer.
- `config/ai.ts` — Model routing, `analyzeImage()` (Stage 1), streaming clients, timeouts.
- `frontend/src/styles/globals.css` — Vanilla CSS design tokens (`--color-primary`, Plus Jakarta Sans font). Strictly no Tailwind CSS.
- `scripts/ship.sh` — Mandatory script for deploying code to staging/production.

## Environments & Isolation

| Environment | Deploy trigger | Domain | D1 DB | R2 bucket |
| :--- | :--- | :--- | :--- | :--- |
| **Production** | Push to `main` | bypostamaker.com | `postmaker-db` | `postmaker-uploads` |
| **Staging** | Push to `staging` | staging.bypostamaker.com | `postmaker-db-dev` / `staging` | `postmaker-uploads-dev` / `staging` |

- Pushing/merging to `main` deploys production only.
- Staging and production databases are strictly isolated. Staging showing empty history is expected if test data has not been generated on staging.

## Standing Facts & Operational Invariants
1. **Two-Stage Generation Pipeline**: Gemini vision analyzes an uploaded image EXACTLY ONCE per generation request. Groq writes per-platform captions in parallel from that single stored text description (`campaigns.image_description`). Never regress this back into calling Gemini per platform.
2. **Quota Isolation**: Primary generation uses `GEMINI_API_KEY` and `GROQ_API_KEY`. Dedicated new features must NEVER share generation keys, protecting paid subscriber quota.
3. **Execution Timeouts**: Cloudflare Workers enforce a 30-second subrequest/wall-clock limit. Stage 1 timeout is 15s; Stage 2 timeout is 10s.
4. **Presigned Upload Architecture**: R2 image uploads use 2-step presigned URLs (`POST /api/upload/presign` -> direct `PUT` to R2 storage URL). S3 SDK options `requestChecksumCalculation: 'WHEN_REQUIRED'` and `responseChecksumValidation: 'WHEN_REQUIRED'` must be set to avoid R2 403 checksum errors.
5. **No Tailwind CSS**: Frontend is styled exclusively via Vanilla CSS custom variables (`globals.css`). Do not introduce `tailwind.config.js` or Tailwind utility classes.
6. **Deploy Guardrail**: `bash scripts/ship.sh` is the only authorized method to push code to `staging` or `main`. Never run manual `git push` directly to deployment branches.
