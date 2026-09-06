> **PAUSED as of 2026-09-06 (Commit: `7e5a1f178adb6ddd839ef46900cf113a6d926ec1`)** — Development on the Omnipost direct-post feature is paused indefinitely. The branch `feat/omnipost-worker-port` is frozen and pushed to `origin`.

# Omnipost Engine Status & Continuity Document

**Repository:** `bypostmaker`  
**Branch:** `feat/omnipost-worker-port` (pushed to `origin/feat/omnipost-worker-port`)  
**Commit Hash:** `7e5a1f178adb6ddd839ef46900cf113a6d926ec1`  
**Status:** Frozen & Paused. 23 Active Adapters Registered & Contract-Verified; 10 Parked Adapters Unregistered; 8 Capability Mismatches Documented.

---

## 1. Architecture Overview

The `omnipost` engine is a production-grade multi-platform publisher module inside `worker/src/omnipost/`.

```
worker/src/omnipost/
├── sdk/                      # Framework Base Interfaces & Standard Classes
│   ├── BaseAdapter.ts        # Abstract BaseAdapter with truncation, error helper
│   ├── PlatformAdapter.ts    # AdapterManifest, AdapterCredentials, PlatformAdapter interfaces
│   └── conformance.ts        # Conformance test suites for adapters
├── core/                     # Core Engine Architecture
│   ├── dispatcher.ts         # Dispatcher with retry (max 3 retries, exponential backoff)
│   ├── registry.ts           # AdapterRegistry with compatibility verification (isCompatible)
│   ├── events.ts             # EventBus for lifecycle tracking (beforePost, afterPost, etc.)
│   └── types.ts              # UnifiedPost, PostResult, AuthType, PlatformCapabilities schemas
├── storage/                  # Storage Wrappers
│   ├── d1ClaimStore.ts       # D1ClaimStore (cross-isolate atomic INSERT OR IGNORE locking)
│   ├── d1Idempotency.ts      # D1IdempotencyStore (atomic delivery status verification)
│   ├── d1RateLimiter.ts      # D1-backed sliding window rate limiter
│   └── d1Vault.ts            # AES-GCM credential vault storage
└── adapters/                 # 33 Platform Adapters (Each with Adapter.ts + oauth.ts)
    ├── batch1/ (8)           # twitter, linkedin, pinterest, telegram, slack, devto, hashnode, github
    ├── batch2/ (6)           # instagram, facebook, youtube, tiktok, youtubeshorts, snapchat
    ├── batch3/ (6)           # medium, producthunt, whatsapp, substack, hackernews, quora
    ├── initial/ (3)          # discord, mastodon, reddit
    ├── batch4a/ (5)          # threads, bluesky, indiehackers, betalist, stackoverflow
    └── batch4b/ (5)          # twitch, clubhouse, dribbble, behance, lemon8
```

**Single System Integration Point:**
`worker/src/routes/omnipost.ts` exports `createStandardAdapterRegistry()`, initializing 23 active registered adapters (10 unhooked for API verification).

---

## 2. Committed History & Real Hashes

Below are the verified commit hashes for all Omnipost features and fixes:

* `7e5a1f1` — `fix(omnipost): reject TikTok text-only posts with validation error and summarize session in OMNIPOST_STATUS.md`
* `f4a5afc` — `docs(omnipost): audit 8 platform capability mismatches and unregister 4 additional unverified adapters`
* `c0708b4` — `fix(omnipost): remove process.env fallback in TwitchAdapter to rely strictly on credentials object`
* `877ea68` — `fix(omnipost): unregister 6 unverified adapters from live registry and align Twitch env var name`
* `39e898f` — `docs(omnipost): add unverified posting APIs audit section to OMNIPOST_STATUS.md`
* `87f719f` — `feat(omnipost): add Batch 4b adapters (Twitch, Clubhouse, Dribbble, Behance, Lemon8), register all 33 adapters, add registry contract test suite and continuity doc`
* `ec07b15` — `fix(omnipost): Phase 3-6 core P0 fixes — D1ClaimStore, idempotency key, dispatcher retry, inline vault`
* `6d5380c` — `feat(omnipost): add Batch 4a adapters (Threads, Bluesky, IndieHackers, BetaList, StackOverflow)`
* `5cd6f3b` — `feat(omnipost): register all 23 platform adapters in AdapterRegistry and omnipost route handler`

---

## 3. Platform Adapter Census (All 33 Adapters)

### Live & Registered (23 Adapters)
`discord`, `mastodon`, `reddit`, `twitter`, `linkedin`, `pinterest`, `telegram`, `slack`, `devto`, `hashnode`, `github`, `instagram`, `facebook`, `youtube`, `tiktok`, `youtubeshorts`, `producthunt`, `whatsapp`, `threads`, `bluesky`, `stackoverflow`, `twitch`, `dribbble`.

### Parked / Unregistered (10 Adapters)
1. **`hackernews`** — No official public REST write API exists; web form POST simulation only.
2. **`medium`** — REST API v1 (`POST /v1/users/{authorId}/posts`) deprecated by Medium.
3. **`indiehackers`** — No REST API exists; session cookie scraping risk.
4. **`betalist`** — Startup submission API placeholder only; no user post API.
5. **`clubhouse`** — Reverse-engineered mobile app API (`POST /api/create_channel`).
6. **`lemon8`** — Reverse-engineered ByteDance internal endpoint (`POST /api/v1/post/create`).
7. **`snapchat`** — No server-side REST API exists; Snap Kit is client-side only (requires phone).
8. **`substack`** — Unauthenticated/cookie-based draft endpoint simulation (`POST /api/v1/posts`).
9. **`quora`** — No public question/answer posting API (Ads API and Poe bot API only).
10. **`behance`** — Adobe revoked public API access; endpoints deprecated.

### Capability Mismatches — Scope / UX Correction Required (8 Adapters)
1. **`linkedin`** — Code posts to `/v2/ugcPosts`. Defaults to personal profile URN (`urn:li:person:...`), but `w_member_social` for personal profiles is restricted/rarely granted by LinkedIn; Organization Pages (`urn:li:organization:...`) require explicit Page selection in UX.
2. **`instagram`** — Graph API (`/v19.0/{igUserId}/media`) strictly requires an Instagram Professional/Creator account linked to a Facebook Page. Personal accounts are unsupported by Meta API.
3. **`facebook`** — Graph API (`/v19.0/{targetId}/feed`) targets Facebook Pages/Groups using Page Access Tokens; direct timeline posting to personal profiles is unsupported by Meta.
4. **`tiktok`** — Direct Post API (`/v2/post/publish/video/init/`) strictly requires `video_url` (media only, no text-only posting). Updated in adapter to return `VALIDATION_ERROR` immediately for text-only posts.
5. **`producthunt`** — Code sends GraphQL `postCreate` mutation assuming product launch. Product Hunt API does not support programmatic product launches (requires web submission & moderation); API only supports comments/votes.
6. **`whatsapp`** — Code sends freeform text/image messages via `/v19.0/{phoneNumberId}/messages`. WhatsApp Cloud API restricts business-initiated messages to pre-approved Message Templates outside 24h user-initiated window.
7. **`stackoverflow`** — Code POSTs to `/2.3/questions/add` with default tags. Programmatic top-level question posting triggers automated spam detection and account suspension.
8. **`twitch`** — `TwitchAdapter` calls `PATCH /helix/channels?broadcaster_id={id}` to update broadcast stream title. No persistent social feed exists; manifest needs UX description update to "Stream Title & Channel Status Update".

---

## 4. Test Suite Status

Executed on Node test runner via `npx tsx --test`:

- **[`worker/test/registryContract.test.ts`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/worker/test/registryContract.test.ts)** — **116 passing tests** (contract metadata, capabilities schema, rate limits, method implementations, and compatibility for all 23 active adapters).
- **[`worker/test/dispatchCore.test.ts`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/worker/test/dispatchCore.test.ts)** — **6 passing tests** (atomic D1 locking, idempotency deduplication, exponential retry backoff, credential vault decryption).
- **Total Pass Count:** **122 tests passing (0 failures)**.

---

## 5. Migration Status

- **Migration File:** `db/migrations/0015_omnipost_claims.sql`
- **Staging D1 (`postmaker-db-staging`):** Migration applied / configured for staging database environment.
- **Production D1 (`postmaker-db`):** **NOT APPLIED to production.** Production D1 database schema remains untouched.
- **Wrangler Verification Commands:**
  ```bash
  npx wrangler d1 migrations list postmaker-db-staging --env staging --remote
  npx wrangler d1 migrations list postmaker-db --env production --remote
  ```

---

## 6. Remaining Human Steps Before Release

Before the `omnipost` engine can be resumed and released:

1. **Pull Request to Staging:** Open PR from `feat/omnipost-worker-port` into `staging`.
2. **Staging Click-Through Test:** Conduct manual verification of credential exchange and live post publishing across active connection cards on staging web UI.
3. **Production DB Migration:** Execute `npx wrangler d1 migrations apply postmaker-db --env production` upon explicit sign-off.
4. **Staging → Main Release PR:** Create and merge PR from `staging` into `main`.

---

## 7. Remote Secrets Configuration Commands

```bash
# Twitter
wrangler secret put OMNIPOST_TWITTER_CLIENT_ID --env staging
wrangler secret put OMNIPOST_TWITTER_CLIENT_SECRET --env staging

# LinkedIn
wrangler secret put OMNIPOST_LINKEDIN_CLIENT_ID --env staging
wrangler secret put OMNIPOST_LINKEDIN_CLIENT_SECRET --env staging

# Mastodon
wrangler secret put OMNIPOST_MASTODON_CLIENT_ID --env staging
wrangler secret put OMNIPOST_MASTODON_CLIENT_SECRET --env staging

# Threads
wrangler secret put OMNIPOST_THREADS_CLIENT_ID --env staging
wrangler secret put OMNIPOST_THREADS_CLIENT_SECRET --env staging

# Reddit
wrangler secret put OMNIPOST_REDDIT_CLIENT_ID --env staging
wrangler secret put OMNIPOST_REDDIT_CLIENT_SECRET --env staging

# Meta (Facebook / Instagram)
wrangler secret put OMNIPOST_META_CLIENT_ID --env staging
wrangler secret put OMNIPOST_META_CLIENT_SECRET --env staging

# Google (YouTube / Shorts)
wrangler secret put OMNIPOST_GOOGLE_CLIENT_ID --env staging
wrangler secret put OMNIPOST_GOOGLE_CLIENT_SECRET --env staging

# Pinterest
wrangler secret put OMNIPOST_PINTEREST_CLIENT_ID --env staging
wrangler secret put OMNIPOST_PINTEREST_CLIENT_SECRET --env staging

# GitHub
wrangler secret put OMNIPOST_GITHUB_CLIENT_ID --env staging
wrangler secret put OMNIPOST_GITHUB_CLIENT_SECRET --env staging

# Discord
wrangler secret put OMNIPOST_DISCORD_BOT_TOKEN --env staging
wrangler secret put OMNIPOST_DISCORD_CLIENT_ID --env staging
wrangler secret put OMNIPOST_DISCORD_CLIENT_SECRET --env staging

# Slack
wrangler secret put OMNIPOST_SLACK_CLIENT_ID --env staging
wrangler secret put OMNIPOST_SLACK_CLIENT_SECRET --env staging

# TikTok
wrangler secret put OMNIPOST_TIKTOK_CLIENT_KEY --env staging
wrangler secret put OMNIPOST_TIKTOK_CLIENT_SECRET --env staging

# Bluesky / StackOverflow / Twitch / Dribbble
wrangler secret put OMNIPOST_BLUESKY_APP_PASSWORD --env staging
wrangler secret put OMNIPOST_STACKOVERFLOW_KEY --env staging
wrangler secret put OMNIPOST_STACKOVERFLOW_CLIENT_ID --env staging
wrangler secret put OMNIPOST_STACKOVERFLOW_CLIENT_SECRET --env staging
wrangler secret put TWITCH_CLIENT_ID --env staging
wrangler secret put OMNIPOST_TWITCH_CLIENT_ID --env staging
wrangler secret put OMNIPOST_TWITCH_CLIENT_SECRET --env staging
wrangler secret put OMNIPOST_DRIBBBLE_CLIENT_ID --env staging
wrangler secret put OMNIPOST_DRIBBBLE_CLIENT_SECRET --env staging
```

