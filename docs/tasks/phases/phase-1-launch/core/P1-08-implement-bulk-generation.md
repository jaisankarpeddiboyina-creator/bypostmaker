# P1-08 — Implement bulk generation

**Phase:** Phase 1 — Launch
**Type:** Core (committed)
**Priority:** Medium
**Owner role:** Engineering
**Depends on:** P1-06
**Status:** Postponed

## Description
Allow generating content for multiple posts/platforms in a single request.

## Definition of Done
User can submit one bulk request and receive outputs for all selected platforms.

## Notes
- **Postponed on:** 2026-08-06
- **Rationale**: Postponed due to low priority for the initial launch gate. PostMaker's current core offering is centered on a single-topic, multi-channel generation workflow, making bulk multi-prompt batch creation non-critical at this stage.
- **Architectural Analysis & Recommendations**:
  - We analyzed the feasibility of a backend-side synchronous bulk processing queue on Cloudflare Workers. Due to the strict **30-second subrequest/execution wall-clock limit** on Cloudflare Workers, a sequential backend loop processing multiple prompts would hit `524 Gateway Timeout` errors.
  - **Recommended Optimal Solution**: When bulk generation is revisited in the future, we recommend **Client-Orchestrated Batching**. The frontend React application should handle multi-prompt parsing (e.g. from user input list or CSV file) and invoke the existing `/api/generate` streaming SSE endpoint in a sequential, throttled loop (max 1 or 2 concurrently). This completely bypasses Cloudflare's 30s timeout limit, controls rate limit pacing to avoid Groq/Gemini API rate limits (TPM/RPM), and isolates failures so that one failing prompt does not abort the entire batch.
  - **Disclaimer**: As the codebase, APIs, and model capabilities evolve over time, the optimal architecture may shift, and this recommendation should be re-evaluated when implementation begins.

