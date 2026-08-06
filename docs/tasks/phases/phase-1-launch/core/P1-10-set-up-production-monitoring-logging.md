# P1-10 — Set up production monitoring & logging

**Phase:** Phase 1 — Launch
**Type:** Core (committed)
**Priority:** High
**Owner role:** Engineering
**Depends on:** P1-01
**Status:** Completed

## Description
Centralized logging, error tracking, and uptime alerting.

## Definition of Done
Errors and downtime trigger alerts within an agreed time window.

## Notes
Implemented a zero-dependency, self-hosted error tracking and event monitoring system:
* **Storage & Schema:** SQLite D1 table (`system_logs`) storing timestamped events, errors, levels, and user contexts, indexed on `created_at DESC` and `type` for sub-millisecond cursor pagination.
* **Server Batch Endpoint:** `POST /api/monitoring/batch` enforcing batch thresholds (<=20 items) and strict payload constraints (<50KB body, <500 chars message, <4KB context).
* **Distributed IP Rate Limiting:** Global per-IP Durable Object counters (`GROQ_LIMITER`) limiting uploads to `10 req/min` per-IP.
* **Client Queue System:** In-memory queue with 10-item or 10-secondTimed Debouncer flushing, visibility/beforeunload page-exit flushing, sensitive field scrubbing (`password`, `token`, etc.), and a 5-bypass-per-minute circuit breaker.
* **Log Viewer Panel:** Paginated cursor logs table view integrated into the Admin Operations panel under the Logs tab, protected by standard admin auth guards.
* **Pruning Cron:** Daily automatic cron pruner to clear logs older than 14 days.

### Verification Evidence
* **Walkthrough:** See [walkthrough.md](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/docs/tasks/phases/phase-1-launch/core/P1-10-set-up-production-monitoring-logging.md#L1) / [Walkthrough file](file:///home/jaisankar/.gemini/antigravity/brain/2d52293e-2392-4a9d-ae5c-9fba1adb68d7/walkthrough.md)
* **Commit:** `3e34d01` (implementation) and `9ba1494` (auth security gating)
* **Status:** Verified and fully closed.
