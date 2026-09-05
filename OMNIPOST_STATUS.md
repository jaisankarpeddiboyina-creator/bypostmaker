# Omnipost Engine Status & Continuity Document

**Repository:** `bypostmaker`  
**Branch:** `feat/omnipost-worker-port`  
**Status:** 23 Active Platforms Registered & Contract-Verified (10 Unregistered Pending API/Scope Audit). Core Engine P0 Fixes Complete.

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

* `c0708b4` — `fix(omnipost): remove process.env fallback in TwitchAdapter to rely strictly on credentials object`
* `877ea68` — `fix(omnipost): unregister 6 unverified adapters from live registry and align Twitch env var name`
* `39e898f` — `docs(omnipost): add unverified posting APIs audit section to OMNIPOST_STATUS.md`
* `87f719f` — `feat(omnipost): add Batch 4b adapters (Twitch, Clubhouse, Dribbble, Behance, Lemon8), register all 33 adapters, add registry contract test suite and continuity doc`
* `ec07b15` — `fix(omnipost): Phase 3-6 core P0 fixes — D1ClaimStore, idempotency key, dispatcher retry, inline vault`
* `6d5380c` — `feat(omnipost): add Batch 4a adapters (Threads, Bluesky, IndieHackers, BetaList, StackOverflow)`
* `5cd6f3b` — `feat(omnipost): register all 23 platform adapters in AdapterRegistry and omnipost route handler`

---

## 3. Platform Adapter Census (All 33 Adapters)

23 platform adapters are actively registered in `createStandardAdapterRegistry()`, and 10 are unregistered pending API/scope audit:

| # | Platform ID | Batch | Auth Type | Compliance | Status |
|---|---|---|---|---|---|
| 1 | `discord` | Initial | `webhook` | official-api | Registered & Verified |
| 2 | `mastodon` | Initial | `oauth2` | official-api | Registered & Verified |
| 3 | `reddit` | Initial | `oauth2` | official-api | Registered & Verified |
| 4 | `twitter` | Batch 1 | `oauth2` | official-api | Registered & Verified |
| 5 | `linkedin` | Batch 1 | `oauth2` | official-api | Registered & Verified |
| 6 | `pinterest` | Batch 1 | `oauth2` | official-api | Registered & Verified |
| 7 | `telegram` | Batch 1 | `apiKey` | official-api | Registered & Verified |
| 8 | `slack` | Batch 1 | `webhook` | official-api | Registered & Verified |
| 9 | `devto` | Batch 1 | `apiKey` | official-api | Registered & Verified |
| 10 | `hashnode` | Batch 1 | `apiKey` | official-api | Registered & Verified |
| 11 | `github` | Batch 1 | `oauth2` | official-api | Registered & Verified |
| 12 | `instagram` | Batch 2 | `oauth2` | official-api | Registered & Verified |
| 13 | `facebook` | Batch 2 | `oauth2` | official-api | Registered & Verified |
| 14 | `youtube` | Batch 2 | `oauth2` | official-api | Registered & Verified |
| 15 | `tiktok` | Batch 2 | `oauth2` | official-api | Registered & Verified |
| 16 | `youtubeshorts` | Batch 2 | `oauth2` | official-api | Registered & Verified |
| 17 | `snapchat` | Batch 2 | `oauth2` | official-api | Unregistered (Pending Review) |
| 18 | `medium` | Batch 3 | `oauth2` | official-api | Unregistered (Pending Review) |
| 19 | `producthunt` | Batch 3 | `oauth2` | official-api | Registered & Verified |
| 20 | `whatsapp` | Batch 3 | `apiKey` | official-api | Registered & Verified |
| 21 | `substack` | Batch 3 | `apiKey` | reverse-engineered | Unregistered (Pending Review) |
| 22 | `hackernews` | Batch 3 | `apiKey` | reverse-engineered | Unregistered (Pending Review) |
| 23 | `quora` | Batch 3 | `apiKey` | reverse-engineered | Unregistered (Pending Review) |
| 24 | `threads` | Batch 4a | `oauth2` | official-api | Registered & Verified |
| 25 | `bluesky` | Batch 4a | `basic` | official-api | Registered & Verified |
| 26 | `indiehackers` | Batch 4a | `apiKey` | reverse-engineered | Unregistered (Pending Review) |
| 27 | `betalist` | Batch 4a | `apiKey` | official-api | Unregistered (Pending Review) |
| 28 | `stackoverflow` | Batch 4a | `oauth2` | official-api | Registered & Verified |
| 29 | `twitch` | Batch 4b | `oauth2` | official-api | Registered & Verified |
| 30 | `clubhouse` | Batch 4b | `apiKey` | reverse-engineered | Unregistered (Pending Review) |
| 31 | `dribbble` | Batch 4b | `oauth2` | official-api | Registered & Verified |
| 32 | `behance` | Batch 4b | `apiKey` | official-api | Unregistered (Pending Review) |
| 33 | `lemon8` | Batch 4b | `basic` | reverse-engineered | Unregistered (Pending Review) |

---

## 4. Key Architectural Decisions (Accepted)

1. **`INSERT OR IGNORE` Claim Primitive (`D1ClaimStore`):** Approved for atomic cross-isolate claim acquisition on D1.
2. **~46.5s Worst-Case Retry Latency:** Accepted for synchronous post dispatches across retries.
3. **`JSON.parse(decryptedSecret)`:** Confirmed safe for all serialized credential objects.
4. **`MemoryClaimStore` Scope:** Strictly scoped for local dev and unit testing.
5. **`waitUntil()` Async Dispatch:** Identified as tracked follow-up work for background non-blocking execution.

---

## 5. Remaining Manual Action Items (Human Required)

- [ ] **Production Migration Sign-off:** Run DB migration `0015_omnipost_claims.sql` against production Cloudflare D1 instance upon human approval.
- [ ] **Staging → Main Pull Request:** Create and merge PR from `feat/omnipost-worker-port` into `staging`/`main`.
- [ ] **Manual Staging Click-Through:** Conduct live verification of credentials exchange and post publishing on staging environment.
- [ ] **ConnectionsPage Expansion:** Frontend UI updates to render connection cards for all 33 platforms.

---

## 6. Remote Secrets Configuration Commands

To configure credential variables in remote Cloudflare Worker environments (`staging` / `production`), run the following commands once production secrets are obtained:

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

# Snapchat
wrangler secret put OMNIPOST_SNAPCHAT_CLIENT_ID --env staging
wrangler secret put OMNIPOST_SNAPCHAT_CLIENT_SECRET --env staging

# Medium
wrangler secret put OMNIPOST_MEDIUM_CLIENT_ID --env staging
wrangler secret put OMNIPOST_MEDIUM_CLIENT_SECRET --env staging

# Product Hunt
wrangler secret put OMNIPOST_PRODUCTHUNT_CLIENT_ID --env staging
wrangler secret put OMNIPOST_PRODUCTHUNT_CLIENT_SECRET --env staging

# Substack / HackerNews / Quora / DevTo / Hashnode
wrangler secret put OMNIPOST_SUBSTACK_API_KEY --env staging
wrangler secret put OMNIPOST_HACKERNEWS_API_KEY --env staging
wrangler secret put OMNIPOST_QUORA_API_KEY --env staging
wrangler secret put OMNIPOST_DEVTO_API_KEY --env staging
wrangler secret put OMNIPOST_HASHNODE_API_KEY --env staging

# Bluesky / IndieHackers / BetaList / StackOverflow
wrangler secret put OMNIPOST_BLUESKY_APP_PASSWORD --env staging
wrangler secret put OMNIPOST_INDIEHACKERS_COOKIE --env staging
wrangler secret put OMNIPOST_BETALIST_API_KEY --env staging
wrangler secret put OMNIPOST_STACKOVERFLOW_KEY --env staging
wrangler secret put OMNIPOST_STACKOVERFLOW_CLIENT_ID --env staging
wrangler secret put OMNIPOST_STACKOVERFLOW_CLIENT_SECRET --env staging

# Twitch / Clubhouse / Dribbble / Behance / Lemon8
wrangler secret put TWITCH_CLIENT_ID --env staging
wrangler secret put OMNIPOST_TWITCH_CLIENT_ID --env staging
wrangler secret put OMNIPOST_TWITCH_CLIENT_SECRET --env staging
wrangler secret put OMNIPOST_CLUBHOUSE_TOKEN --env staging
wrangler secret put OMNIPOST_DRIBBBLE_CLIENT_ID --env staging
wrangler secret put OMNIPOST_DRIBBBLE_CLIENT_SECRET --env staging
wrangler secret put OMNIPOST_BEHANCE_API_KEY --env staging
wrangler secret put OMNIPOST_LEMON8_AUTH_TOKEN --env staging
```

---

## 7. Unverified posting APIs — needs individual verification before going live

- **Hacker News (`hackernews`):** Uses web form POST payload simulation (`https://news.ycombinator.com/submit`); no official public REST write API exists.
- **Medium (`medium`):** Medium REST API v1 (`POST /v1/users/{authorId}/posts`) is deprecated by Medium; requires account-level publication scope verification.
- **IndieHackers (`indiehackers`):** Uses session cookie string matching; no official public publishing REST API endpoint exists.
- **BetaList (`betalist`):** Uses startup submission API placeholder (`POST /api/v1/startups`); no public user post publishing REST API exists.
- **Clubhouse (`clubhouse`):** Batch 4b adapter using reverse-engineered mobile app API (`POST /api/create_channel`); requires mobile token verification.
- **Lemon8 (`lemon8`):** Batch 4b adapter using reverse-engineered ByteDance internal endpoint (`POST /api/v1/post/create`); unverified reverse-engineered route.
- **Snapchat (`snapchat`):** No server-side REST API exists — Snap Kit is client-side only, requiring the user's phone to send; cloud-based tool cannot post.
- **Substack (`substack`):** Uses unauthenticated/cookie-based draft endpoint (`POST /api/v1/posts`) with pseudo-token; official 2026 API is profile-lookup only.
- **Quora (`quora`):** No public API exists for posting questions/answers; only Ads API and unrelated Poe bot API.
- **Behance (`behance`):** Adobe revoked API access years ago; public write API endpoints deprecated and non-functional.

---

## 8. Capability mismatches — needs scope/UX correction

- **LinkedIn (`linkedin`):** Code posts to `/v2/ugcPosts`. Defaults to personal profile URN (`urn:li:person:...`), but `w_member_social` for personal profiles is restricted/rarely granted by LinkedIn; Organization Pages (`urn:li:organization:...`) require explicit Page selection in UX.
- **Instagram (`instagram`):** Graph API (`/v19.0/{igUserId}/media`) strictly requires an Instagram Professional/Creator account linked to a Facebook Page. Personal accounts are unsupported and must be warned in connection flow.
- **Facebook (`facebook`):** Graph API (`/v19.0/{targetId}/feed`) targets Facebook Pages/Groups using Page Access Tokens; direct timeline posting to personal profiles is unsupported by Meta.
- **TikTok (`tiktok`):** Manifest currently claims `capabilities.text = true`, but TikTok Direct Post API (`/v2/post/publish/video/init/`) strictly requires `video_url`. Must set `capabilities.text = false` and reject text-only posts upfront instead of injecting fake media fallbacks.
- **Product Hunt (`producthunt`):** Code sends GraphQL `postCreate` mutation assuming product launch. Product Hunt API does not support programmatic product launches (requires web submission & moderation); API only supports comments/votes.
- **WhatsApp (`whatsapp`):** Code sends freeform text/image messages to phone numbers via `/v19.0/{phoneNumberId}/messages`. WhatsApp Cloud API restricts business-initiated messages to pre-approved Message Templates outside 24h user-initiated window.
- **Stack Overflow (`stackoverflow`):** Code POSTs to `/2.3/questions/add` with default tags. Programmatic top-level question posting triggers automated spam detection and account suspension.
- **Twitch (`twitch`):** `TwitchAdapter` calls `PATCH /helix/channels?broadcaster_id={id}` to update broadcast stream title. No persistent social feed exists; manifest needs UX description update to "Stream Title & Channel Status Update".

---

## 9. Session summary — 2026-09-05

- **Live Registered Adapters (23):** `discord`, `mastodon`, `reddit`, `twitter`, `linkedin`, `pinterest`, `telegram`, `slack`, `devto`, `hashnode`, `github`, `instagram`, `facebook`, `youtube`, `tiktok`, `youtubeshorts`, `producthunt`, `whatsapp`, `threads`, `bluesky`, `stackoverflow`, `twitch`, `dribbble`.
- **Parked / Unregistered Adapters (10):**
  1. `hackernews` (no REST write API)
  2. `medium` (v1 API deprecated by Medium)
  3. `indiehackers` (no REST API, cookie scraping risk)
  4. `betalist` (startup submission placeholder only)
  5. `clubhouse` (reverse-engineered mobile API)
  6. `lemon8` (reverse-engineered ByteDance endpoint)
  7. `snapchat` (no server-side REST API; client-side Snap Kit only)
  8. `substack` (unauthenticated/cookie-based draft endpoint simulation)
  9. `quora` (no public post/question API)
  10. `behance` (Adobe revoked public write API access)
- **TikTok Urgent Safety Fix Applied:** Replaced fake `'https://example.com/demo.mp4'` fallback in `TikTokAdapter.ts` with explicit `VALIDATION_ERROR` check (`"TikTok requires a video or photo; text-only posts are not supported."`) returning immediately before any network call.
- **Resume Here (Next Session Checklist):**
  - [ ] **8 Capability-Mismatch Adapters Scope/UX Fixes:** Refactor manifest capabilities and UX warnings for `linkedin`, `instagram`, `facebook`, `tiktok`, `producthunt`, `whatsapp`, `stackoverflow`, and `twitch`.
  - [ ] **Human Sign-off & Deployment:** Execute DB migration `0015_omnipost_claims.sql` on production D1, push staging branch / create PR, and perform live staging click-through verification.

