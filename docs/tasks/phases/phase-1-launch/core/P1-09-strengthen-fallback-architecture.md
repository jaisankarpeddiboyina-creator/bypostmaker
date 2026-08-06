# P1-09 — Strengthen fallback architecture

**Phase:** Phase 1 — Launch
**Type:** Core (committed)
**Priority:** High
**Owner role:** Engineering
**Depends on:** P1-06
**Status:** Completed

## Description
Auto-fallback to a secondary AI provider on failure or timeout.

## Definition of Done
Simulated primary-provider outage still returns a successful generation via fallback.

## Notes
Implemented Stage 2 text generation fallback routing inside `createStreamingClient()`. Runs primary model for 5s (buffered), and falls back automatically to secondary model for 11s (direct stream) upon primary failure or timeout. Allowed custom fallback override via `TEXT_FALLBACK_PROVIDER` env variable. Modified Stage 1 (Vision) timeout to 12s. All behaviors verified via live-call test suite.

