# P1-06 — Improve AI provider reliability/routing

**Phase:** Phase 1 — Launch
**Type:** Core (committed)
**Priority:** High
**Owner role:** Engineering
**Depends on:** None
**Status:** Completed

## Description
Strengthen routing logic across AI providers for consistent uptime.

## Definition of Done
Provider failures automatically route without user-facing errors in test scenarios.

## Notes
Cloudflare AI Gateway (postmaker-gateway) fully integrated with Gemini 2.5 flash and Groq text models. Rate limits slots and tokens are dynamically checked and handled. Failed requests fallback and raise detailed descriptive messages.

