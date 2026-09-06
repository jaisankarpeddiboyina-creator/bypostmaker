# Omnipost Engine & Connections Complete Continuity Document

> **STATUS: PAUSED & GATED as of 2026-09-06**  
> - **Main Branch (`main` / `origin/main`):** Commit `439d1df` — Legacy Connections page (`/app/connections`) & backend API (`/api/omnipost/*`) are fully gated with HTTP 503.  
> - **Direct-Post Engine Branch (`feat/omnipost-worker-port` / `origin/feat/omnipost-worker-port`):** Commit `354f668` — Complete 33-platform engine frozen, tested (122 tests passing), documented, and pushed to `origin`.

---

## 1. Branch Architecture & Status Summary

| Branch | Push Status | Target Feature | Current State |
|---|---|---|---|
| **`main`** | Pushed to `origin/main` | Production App | `/app/connections` redirects to `/app/create`; `/api/omnipost/*` returns 503 Feature Unavailable. Database records untouched. |
| **`feat/omnipost-worker-port`** | Pushed to `origin/feat/omnipost-worker-port` | 33-Platform Adapter Engine | Frozen & Paused. 23 active adapters registered & contract-tested; 10 unverified adapters parked; 8 scope/capability mismatches documented. |

---

## 2. Main Branch Gating Details

As of 2026-09-06 (Commit `439d1df`), entry points to the legacy omnipost connections feature on `main` have been disabled cleanly:

- **Frontend Route ([`frontend/src/App.tsx`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/frontend/src/App.tsx#L265)):** `<Route path="/app/connections" element={<Navigate to="/app" replace />} />` automatically redirects user traffic to `/app/create`.
- **Backend API ([`worker/src/index.ts`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/worker/src/index.ts#L649)):** `path.startsWith('/api/omnipost')` returns `HTTP 503` (`{ "error": "Feature unavailable", "message": "The connections feature is currently unavailable." }`).
- **Database Safety:** The `omnipost_connections` D1 table and user data remain **100% untouched**.
- **Background Cron:** Stale pending token cleanup in `worker/src/services/cron.ts` continues running safely.

---

## 3. Paused Engine Branch (`feat/omnipost-worker-port`) Census

### Platform Census (33 Adapters Total)
- **Active & Registered (23 Adapters):** `discord`, `mastodon`, `reddit`, `twitter`, `linkedin`, `pinterest`, `telegram`, `slack`, `devto`, `hashnode`, `github`, `instagram`, `facebook`, `youtube`, `tiktok`, `youtubeshorts`, `producthunt`, `whatsapp`, `threads`, `bluesky`, `stackoverflow`, `twitch`, `dribbble`.
- **Parked / Unregistered (10 Adapters):** `hackernews`, `medium`, `indiehackers`, `betalist`, `clubhouse`, `lemon8`, `snapchat`, `substack`, `quora`, `behance` (Parked due to lack of official REST write APIs or deprecated endpoints).
- **Capability Mismatches (8 Adapters):** `linkedin`, `instagram`, `facebook`, `tiktok`, `producthunt`, `whatsapp`, `stackoverflow`, `twitch` (Documented in detail for scope/UX corrections before launch).

### Test & Migration Status on `feat/omnipost-worker-port`
- **Contract Tests:** `worker/test/registryContract.test.ts` (116 passing tests).
- **Core Engine Tests:** `worker/test/dispatchCore.test.ts` (6 passing tests).
- **Total Tests Passing:** **122 / 122 tests passing (0 failures)**.
- **Migration `0015_omnipost_claims.sql`:** Configured on Staging D1 (`postmaker-db-staging`); **NOT applied to Production D1**.

---

## 4. How to Resume Work in the Future

### To resume the Direct-Post Engine:
1. Checkout the branch: `git checkout feat/omnipost-worker-port`
2. Address the 8 platform scope/UX fixes listed in Section 3.
3. Apply migration `0015_omnipost_claims.sql` to production D1 upon human approval.
4. Test on staging web UI and open PR into `staging` / `main`.

### To re-enable the legacy Connections page on `main`:
1. Restore route in `frontend/src/App.tsx` (`<Route path="/app/connections" element={<AuthGuard><AppShell><ConnectionsPage /></AppShell></AuthGuard>} />`).
2. Remove 503 interceptor block in `worker/src/index.ts`.
