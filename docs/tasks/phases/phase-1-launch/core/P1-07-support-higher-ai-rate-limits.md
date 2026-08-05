# P1-07 — Support higher AI rate limits

**Phase:** Phase 1 — Launch
**Type:** Core (committed)
**Priority:** Medium
**Owner role:** Engineering
**Depends on:** P1-06
**Status:** Completed

## Description
Consolidate 8 small platform groups into 3 execution batch buckets (`social`, `community_longform`, `media_design_messaging`) while preserving UI category tabs, enabling dynamic environment-driven token sizing (`AI_MAX_OUTPUT_TOKENS`, `AI_MAX_PLATFORMS_PER_BATCH`, `AI_AVG_TOKENS_PER_PLATFORM`), sub-batch chunking via `groupAndChunkPlatforms`, script-aware token multipliers for non-Latin scripts, and 2-stage fail-soft JSON parsing.

## Definition of Done
- [x] 33 platforms mapped to 3 execution buckets (`social` 11, `community_longform` 13, `media_design_messaging` 9).
- [x] Zero hardcoded token limits (`parseEnvInt` fallback: `maxOutputTokens=4096`, `maxPlatformsPerBatch=10`, `avgTokensPerPlatform=250`).
- [x] Dynamic output token formula: `min(maxOutputTokens - 256, max(512, rawOutputTokens))`.
- [x] Script-aware multipliers (`en` 1.0x, `hi`/`zh`/`ja`/`ko` 3.0x, `ar` 2.4x, `ru`/`el` 1.8x) applied symmetrically to input and output token estimations.
- [x] 2-stage fail-soft JSON parsing: Stage 1 standard `JSON.parse`, Stage 2 regex key-value extractor (`/"(platform_id)"\s*:\s*"((?:[^"\\]|\\.)*)"/g`), with explicit SSE `event: error` emission for unrecoverable platforms.
- [x] Fully verified via type-check, production build, mock math test, single-platform retry output, 2-stage parser unit tests, script multiplier unit tests, and real 4-platform single-batch SSE stream test.

## Notes
- Completed on 2026-08-03 under commit `d2ef3f26bbb0ada381bf7bb02b9f31f33f247401`.
- Primary spec updated: [DOC-2026-004: Two-Stage AI Generation Pipeline Spec](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/docs/features/two-stage-generation.md).

