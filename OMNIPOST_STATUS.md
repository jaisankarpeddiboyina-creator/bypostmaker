# Omnipost Engine & Connections Status Document

> **LIVE CONNECTIONS FEATURE GATED as of 2026-09-06**  
> The legacy webhook-based Connections page (`/app/connections`) and API (`/api/omnipost/*`) on `main` have been gated and made unavailable.  
> *Note:* This legacy feature is separate and distinct from the multi-platform adapter engine developed on the paused branch `feat/omnipost-worker-port`.

---

## 1. Gated Legacy Entry Points (Main Branch)

As of 2026-09-06, access to the legacy Omnipost connections interface and backend API routes has been disabled without deleting database records or core handler code.

### Files Modified:
1. **[`frontend/src/App.tsx`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/frontend/src/App.tsx#L263-L267):**
   - Route `/app/connections` now redirects to `/app` (`/app/create`).
2. **[`worker/src/index.ts`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/worker/src/index.ts#L648-L657):**
   - Intercepts all requests matching `/api/omnipost/*` and returns HTTP 503 (`{ "error": "Feature unavailable", "message": "The connections feature is currently unavailable." }`).
3. **[`OMNIPOST_STATUS.md`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/OMNIPOST_STATUS.md):**
   - Continuity documentation added to track the gating status on `main`.

### Database Integrity:
- The **`omnipost_connections` D1 table**, its schema, and all stored connection records remain **100% untouched**.
- The cron pruning job ([`worker/src/services/cron.ts`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/worker/src/services/cron.ts)) remains active to safely clean up expired pending tokens.

---

## 2. Distinction from `feat/omnipost-worker-port`

- **Branch `feat/omnipost-worker-port` (Paused):** Contains the 33-platform adapter architecture (`worker/src/omnipost/`), 23 registered adapters, contract test suite, and atomic claim locking. Frozen and pushed to `origin/feat/omnipost-worker-port`.
- **Branch `main` (Live Gated):** Legacy webhook/OAuth handler. Gated via 503 API interceptor and frontend route redirect.
