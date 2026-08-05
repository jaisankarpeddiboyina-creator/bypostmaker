# P1-06 — Improve AI provider reliability & routing

**Phase:** Phase 1 — Launch
**Type:** Core (committed)
**Priority:** High
**Owner role:** Engineering
**Status:** Completed

## Description
Strengthen routing logic across AI providers for consistent uptime using Cloudflare AI Gateway integration.

## Definition of Done
- [x] Connected PostMaker two-stage pipeline (Vision & Text) to Cloudflare AI Gateway.
- [x] Configured single Cloudflare API Token authentication (`CLOUDFLARE_API_TOKEN`) with BYOK / credit gateway routing.
- [x] Enabled flexible runtime model selection (`TEXT_MODEL` and `VISION_MODEL`).
- [x] Empirically verified Stage 1 Vision (`gemini-2.5-flash`) and Stage 2 Text Streaming (`llama-3.1-8b-instant`).
- [x] Verified zero TypeScript errors (`npm run type-check`) and production build success (`npm run build`).

## Notes
- Completed on 2026-08-05. Empirically verified via `scratch/test-cf-gateway.ts`.
