# PostMaker — Project Architecture & Context Reference

> **Authoritative Source of Truth**: This document records the real, unvarnished state of the PostMaker repository as of July 22, 2026. It exists to provide complete context to future sessions and prevent false assumptions regarding working code vs. placeholders.

---

## 1. What PostMaker Is

PostMaker is a live production SaaS application that generates platform-tailored social media content across 30+ platforms from a single user prompt. It features real paying users, Razorpay recurring billing, Cloudflare D1 database storage, R2 asset storage, a two-stage vision and text AI generation pipeline, and a user Brand Kit manager.

---

## 2. Stack & Architecture

- **Frontend**: React 18, TypeScript, Vite SPA ([`frontend/src/App.tsx`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/frontend/src/App.tsx)). Styled using Vanilla CSS custom properties in [`frontend/src/styles/globals.css`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/frontend/src/styles/globals.css) (no Tailwind CSS).
- **Backend Worker**: Cloudflare Workers (TypeScript) entry point at [`worker/src/index.ts`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/worker/src/index.ts).
- **Database**: Cloudflare D1 SQL database. Schema definition in [`db/schema.sql`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/db/schema.sql), migrations in [`db/migrations/*.sql`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/db/migrations).
- **Object Storage**: Cloudflare R2 bucket. Upload presigning in [`worker/src/routes/upload.ts`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/worker/src/routes/upload.ts).
- **AI SDK**: `@ailink/sdk` (^0.3.0) used in [`config/ai.ts`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/config/ai.ts) for model routing and fallback management.
- **Deploy Triggers & CI/CD**:
  - `main` branch push -> triggers Cloudflare Worker deployment to `production` environment (`wrangler deploy --env production`).
  - `staging` branch push -> triggers Cloudflare Worker deployment to `staging` environment (`wrangler deploy --env staging`).

### Two-Stage Generation Pipeline (MANDATORY Architecture)
- **Stage 1 (Vision)**: Executed in [`config/ai.ts`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/config/ai.ts#L114-L217) (`analyzeImage()`). Sends uploaded images to Gemini (`env.GEMINI_API_KEY`) exactly once, producing a structured JSON description. This description is saved to the `campaigns` table in D1 (`image_description` column).
- **Stage 2 (Caption Text)**: Executed in [`worker/src/routes/generate.ts`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/worker/src/routes/generate.ts). Reads the stored `image_description` from D1 and uses Groq (`env.GROQ_API_KEY`, `llama-3.3-70b-versatile`) to generate multi-platform captions.
- **Why It Must Stay Two-Stage**: Cloudflare Workers have a 30-second subrequest/execution limit. Running vision analysis per platform or inside retry loops causes wall-clock timeouts. Stage 1 caches visual understanding; Stage 2 handles fast text generation and platform retries without ever re-calling Gemini vision.

---

## 3. Standing Facts & Constraints (Prior Incident History)

1. **Subrequest & Wall-Clock Limit**: Cloudflare Workers enforce a 30-second execution cap. Stage 1 has a strict 15s AbortController timeout; Stage 2 has a 10s cap.
2. **Quota Isolation**: The core post-generation pipeline uses `GEMINI_API_KEY` and `GROQ_API_KEY`. Dedicated new features must **NEVER** share `GEMINI_API_KEY` or `GROQ_API_KEY` quotas, protecting paid subscriber generation limits.
3. **Database Environment Isolation**: `postmaker-db-dev` (local), `postmaker-db-staging` (staging), and `postmaker-db` (production) are strictly isolated D1 databases.
4. **Presigned Upload Architecture**: R2 image uploads use 2-step presigned URLs (`POST /api/upload/presign` -> direct `PUT` to R2 storage URL). AWS S3 SDK options `requestChecksumCalculation: 'WHEN_REQUIRED'` and `responseChecksumValidation: 'WHEN_REQUIRED'` must be set to prevent R2 403 checksum mismatch errors.
5. **No Tailwind**: The frontend is built on Vanilla CSS design tokens (`globals.css`). Do not introduce `tailwind.config.js` or Tailwind utility classes.

---

## 4. Feature Inventory & Verification Status

| Feature | Implementation File Paths | Real Status | Runtime Evidence & Date |
|---|---|---|---|
| **Auth & Sessions** | [`worker/src/middleware/auth.ts`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/worker/src/middleware/auth.ts), [`worker/src/routes/auth.ts`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/worker/src/routes/auth.ts) | **CONFIRMED WORKING** | Verified Google OAuth & Cookie-based JWT (`pm_session`) auth. |
| **Billing & Payments** | [`worker/src/routes/payments.ts`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/worker/src/routes/payments.ts), [`worker/src/routes/webhook.ts`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/worker/src/routes/webhook.ts) | **CONFIRMED WORKING** | Verified Razorpay webhook signature verification, plan limits, and D1 subscription state sync. |
| **Core Post Generation** | [`worker/src/routes/generate.ts`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/worker/src/routes/generate.ts), [`config/ai.ts`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/config/ai.ts) | **CONFIRMED WORKING** | Verified SSE streaming multi-platform post generation with Stage 1 Gemini vision and Stage 2 Groq text. |
| **Brand Kit** | [`db/migrations/0006_add_brand_kit.sql`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/db/migrations/0006_add_brand_kit.sql), [`db/migrations/0007_extend_brand_kit.sql`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/db/migrations/0007_extend_brand_kit.sql), [`worker/src/routes/brand-kit.ts`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/worker/src/routes/brand-kit.ts), [`frontend/src/pages/BrandKitPage.tsx`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/frontend/src/pages/BrandKitPage.tsx) | **CONFIRMED WORKING (DORMANT - NOT WIRED TO GENERATION)** | Redesigned & extended on July 23, 2026. Added platform_links (dynamic multi-platform manager for all 33 platforms), products_services, target_audience, competitors, and brand_guidelines. Implemented JSON export, JSON import with preview modal, row deletion with confirmation modal, and secure owner-verified asset streaming. **NOTE**: Brand Kit currently saves and serves its own data only — it is **NOT YET** connected to post generation (`generate.ts`) or any other feature. This is intentional, deferred by product decision, not a bug or gap. Future work item: inject brand voice/tone/colors into the generation pipeline when that's prioritized. |
| **AI Studio Hub** | Previously `config/tools.ts`, `frontend/src/pages/StudioPage.tsx` | **REMOVED (July 23, 2026)** | Existed briefly as a tool registry prototype. Completely removed on July 23, 2026 to keep codebase focused on core post generation and Brand Kit. |
| **AI Thumbnail Maker** | Previously `worker/src/routes/thumbnail.ts`, `frontend/src/pages/ThumbnailMakerPage.tsx` | **REMOVED (July 23, 2026)** | Existed as a prototype returning static `placehold.co` placeholder images. Completely removed on July 23, 2026. |

---

## 5. Known Open Decisions & TODOs

1. **Multi-iteration Auto-repair Loop**: Deferred to v2.
2. **Design Knowledge Base Memory Store**: Deferred to v2.
3. **Multi-Brand Support per User**: v1 supports 1 primary Brand Kit per user; multi-brand switching deferred to v2.


---

## 6. How to Work in This Repository

1. **Strict 3-Phase Workflow**:
   - **Phase 1: Research & Verify**: Inspect actual files, D1 tables, and git diffs before making claims. Never guess.
   - **Phase 2: Implementation Plan & Approval**: Create `implementation_plan.md` artifact and obtain explicit user approval before touching code.
   - **Phase 3: Execution & Empirical Verification**: Implement code, run tests (`npm run type-check`, `npm run build`), verify D1 queries and API responses, and run UI screenshots.
2. **Evidence Standard**: A feature is ONLY "working" when backed up by actual command outputs, API response JSON, D1 query rows, or screenshot files. "Should work" or "structurally correct" is strictly invalid.
3. **Incident History Caution**: In a previous session, a summary claimed the AI Thumbnail Maker was "fully working end-to-end" when `thumbnail.ts` was actually returning `placehold.co` placeholder URLs. Always distinguish between metadata/scoring logic and real model generation.
