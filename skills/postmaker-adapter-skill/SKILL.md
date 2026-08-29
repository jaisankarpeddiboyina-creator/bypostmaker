---
name: postmaker-adapter-skill
description: Standardized 1:1 Apple-Staff-Engineer reference guide and architecture for building production-ready Omnipost platform adapters (Discord, Mastodon, Reddit, X/Twitter, LinkedIn, YouTube, Pinterest, etc.). Trigger whenever building, updating, refactoring, or testing platform adapters, OAuth code exchanges, formatters, error mappers, or conformance suites in the Omnipost engine.
---

# 🚀 PostMaker Omnipost Platform Adapter Standard

This document establishes the mandatory engineering standard for creating, updating, and testing platform adapters in PostMaker's `omnipost` multi-platform publishing engine. It captures design patterns, security rules, error-handling conventions, and testing protocols established across reference implementations:
- `worker/src/omnipost/adapters/discord/DiscordAdapter.ts`
- `worker/src/omnipost/adapters/mastodon/MastodonAdapter.ts` & `oauth.ts`
- `worker/src/omnipost/adapters/reddit/RedditAdapter.ts` & `oauth.ts`

---

## 🔍 1. Mandatory Pre-Implementation Research

Before writing any adapter code, you **MUST** perform web search research against the platform's current official developer documentation:
- **Authentication & OAuth Grant Flow**: Authorization endpoints, code exchange (`authorization_code`), refresh tokens (`refresh_token`), token expiration, and client secrets.
- **Required Scopes & Permissions**: Minimum required OAuth scopes (e.g., Reddit: `identity`, `submit`, `read`; Mastodon: `read`, `write:statuses`, `write:media`).
- **Required HTTP Headers**: Special header rules (e.g., Reddit mandates custom `User-Agent: <platform>:<app_id>:<version> (by /u/<username>)`; generic/browser User-Agents are silent-blocked).
- **Posting API Endpoint & Payloads**: Content-Type (`application/json` vs `application/x-www-form-urlencoded`), body fields (`api_type=json`, `sr`, `kind`, `title`, `text`, `url`).
- **Rate Limits & Headers**: Window sizes, request quotas, and rate-limit reset headers (`X-Ratelimit-Remaining`, `X-Ratelimit-Reset`).
- **External API & Approval Gates**: Document whether the platform requires an app review, developer approval, or paid API tier (e.g., Meta App Review for Instagram/Facebook, X/Twitter API Paid Tiers).

> [!IMPORTANT]
> Never rely on memory or training data for API payload shapes or OAuth endpoints. Always cite web research sources in the implementation report.

---

## 🏛️ 2. Required File Architecture Per Adapter

Every platform adapter lives under `worker/src/omnipost/adapters/<platform>/` and consists of:

```
worker/src/omnipost/adapters/<platform>/
├── <Platform>Adapter.ts    # Extends BaseAdapter (manifest, authenticate, format, post, healthCheck)
└── oauth.ts                # BOTH code exchange AND token refresh functions
```

### Reference `oauth.ts` Interface Signature
Every `oauth.ts` file must export two mandatory functions:

1. **Initial Authorization Code Exchange**: `exchange<Platform>Code(...)`
2. **Token Refresh**: `refresh<Platform>Token(...)`

#### Real Reference Shapes:
- **Mastodon** ([`worker/src/omnipost/adapters/mastodon/oauth.ts`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/worker/src/omnipost/adapters/mastodon/oauth.ts)):
  - `exchangeMastodonCode(instanceUrl, code, redirectUri, clientId, clientSecret)`
  - `refreshMastodonToken(instanceUrl, credentials, clientId, clientSecret)`
- **Reddit** ([`worker/src/omnipost/adapters/reddit/oauth.ts`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/worker/src/omnipost/adapters/reddit/oauth.ts)):
  - `exchangeRedditCode(code, redirectUri, clientId, clientSecret)`
  - `refreshRedditToken(credentials, clientId, clientSecret)`

---

## 🛡️ 3. The `format()` Rule: Zero Silent Data Loss

`format(post: UnifiedPost)` transforms a `UnifiedPost` into the platform-specific payload shape.

### Mandatory Directive
**Never silently drop any portion of the user's content (media link, image, or text caption) to fit a platform's API shape.**

> [!CAUTION]
> **Cautionary Anti-Pattern (The Reddit Bug Fixed)**:
> Initially, when a post contained both a caption text AND a media URL, `RedditAdapter.format()` checked `if (hasExternalLink && !bodyText)` to create link posts, but fell back to text-only `kind: 'self'` when `bodyText` was present — silently dropping the user's media URL!

### Correct Pattern (Media Preservation)
When a platform API cannot natively combine full body text and link URLs in a single payload type (e.g., Reddit `kind: 'self'` vs `kind: 'link'`):
1. **Option A (Preferred)**: Map to a link post (`kind: 'link'`), folding the caption text into the post `title` (truncated to 300 chars max) and preserving the external link/media URL.
2. **Option B**: Return a `VALIDATION_ERROR` from `post()` explaining that the platform cannot combine text and media, rather than dropping media and returning success.

---

## 🩺 4. The `healthCheck()` Rule: Real Authenticated API Checks

`healthCheck(credentials?: AdapterCredentials)` must perform a real, lightweight authenticated HTTP check against the platform when credentials are provided. **No-op stubs or hardcoded `{ ok: true }` returns are forbidden.**

#### Reference Implementation (Reddit `GET /api/v1/me`):
```ts
async healthCheck(credentials?: AdapterCredentials): Promise<{ ok: boolean; latencyMs?: number }> {
  const start = Date.now();
  if (!credentials?.accessToken) {
    return { ok: true, latencyMs: Date.now() - start };
  }

  try {
    const response = await fetch('https://oauth.reddit.com/api/v1/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'User-Agent': (credentials.userAgent as string) || REDDIT_USER_AGENT,
      },
    });
    return { ok: response.ok, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}
```

---

## 🚦 5. Standardized Error Mapping (`PostError`)

All platform-specific error messages and HTTP status codes must be mapped into normalized `PostError` objects with accurate `retryable` flags.

At minimum, every adapter must map:
1. **Rate Limits** -> `RATE_LIMITED` (`retryable: true`)
2. **Invalid Target/Subreddit/Channel** -> `INVALID_SUBREDDIT` or `INVALID_TARGET` (`retryable: false`)
3. **Forbidden/Banned/Unauthorized** -> `FORBIDDEN` (`retryable: false`)
4. **Platform Rule Validation (e.g. Flair Required, Text Missing)** -> `VALIDATION_ERROR` (`retryable: false`)

---

## 🧪 6. Verification Suite Requirements

Every new adapter must have an accompanying automated test suite (`worker/test/<platform>Adapter.test.ts`) executed via `npx tsx worker/test/<platform>Adapter.test.ts`.

### Mandatory Test Cases:
1. **`runConformanceSuite(new <Platform>Adapter())`**: Validates manifest structure and core adapter contract methods.
2. **Media Preservation Test**: Verifies `format()` when text caption and media URLs are both present.
3. **HTTP Boundary Test**: Mocks `globalThis.fetch` at the HTTP network boundary and calls the **real** `adapter.post(payload, credentials)` method — verifying captured URL, Authorization headers, Content-Type, custom User-Agent, and form payload.
4. **Mapped Error Tests**: One distinct test per mapped error code (`RATE_LIMITED`, `FORBIDDEN`, `VALIDATION_ERROR`).
5. **OAuth Code Exchange Test**: Verifies `exchange<Platform>Code(...)` returns structured access/refresh tokens.

---

## 🔑 7. Platform Gate & App Review Checklist

Before declaring an adapter ready for production deployment, check and document platform external gates:

- [ ] **App Review / Verification**: Does the platform require formal app review before end users can log in? (e.g. Meta / LinkedIn / TikTok).
- [ ] **API Tier / Pricing**: Does the platform mandate a paid subscription tier for automated posting endpoints? (e.g. X / Twitter API v2 Basic/Pro tier).
- [ ] **User-Agent & Disclosure Compliance**: Are custom User-Agent headers or automated posting disclaimers enforced?
- [ ] **OAuth Redirect URIs**: Are staging (`https://staging.bypostamaker.com/api/omnipost/oauth/callback`) and production redirect URIs registered in the platform developer portal?
