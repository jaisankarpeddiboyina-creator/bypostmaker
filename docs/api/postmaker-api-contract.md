---
id: DOC-2026-002
title: PostMaker API Contract & Endpoint Specification
category: API
status: Stable
owner: Backend Lead
created_at: 2026-07-31
last_updated: 2026-07-31
version: 1.0.0
breaking_changes: No
migration_needed: No
compatible_since: v1.0.0
deprecated_since: N/A
---

# PostMaker API Contract & Endpoint Specification

## Documentation Relationships

- **Depends On**:
  - [DOC-2026-001: System Architecture](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/docs/architecture/system-overview.md)
  - [DOC-2026-003: D1 Database Schema](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/docs/database/d1-schema-spec.md)
- **Used By**:
  - [DOC-2026-004: Two-Stage Generation Spec](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/docs/features/two-stage-generation.md)
  - [DOC-2026-005: Brand Kit Manager Architecture](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/docs/features/brand-kit.md)

---

## AI Context & Guardrails

> [!IMPORTANT]
> **Operational Guardrails for AI Agents**

- **Purpose**: Authoritative contract for all REST endpoints and SSE streaming connections supported by `bypostamaker-worker`.
- **Inputs**: HTTP headers (`Cookie: pm_session`), JSON request bodies, multipart upload headers.
- **Outputs**: Typed JSON responses (`{ ok: true, ... }`), HTTP error objects (`{ error: string }`), SSE stream event frames.
- **Dependencies**: Cloudflare Workers, Hono router, JWT authentication middleware, D1 database binding `env.DB`.
- **Constraints**: All client calls MUST pass `credentials: 'include'` to send cookie auth.
- **Business Rules**: `POST /api/generate` is an SSE stream, NOT a single JSON fetch.
- **Failure Modes**: 401 Unauthorized, 403 Forbidden asset access, 429 Too Many Requests.
- **Security Guardrails**: Strict HttpOnly JWT cookies, owner verification on asset streams, Razorpay signature validation.
- **DO NOT CHANGE**: Cookie name `pm_session`, SSE frame format (`event: ...\ndata: ...\n\n`), or upload 2-step presigned flow.

---

## Endpoint Contract Summary

### 1. Authentication Endpoints

```http
GET /auth/google
POST /auth/email/signup
POST /auth/email/login
POST /auth/logout
```

#### `POST /auth/email/login` Example
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "SecretPassword123"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "user": {
      "id": "usr_992182",
      "email": "user@example.com",
      "name": "Jane Doe"
    }
  }
  ```

---

### 2. User & Usage Endpoints

```http
GET /api/user/me
PUT /api/user/currency
DELETE /api/user/account
```

#### `GET /api/user/me` Response (200 OK)
```json
{
  "user": {
    "id": "usr_992182",
    "email": "user@example.com",
    "name": "Jane Doe",
    "plan": "pro"
  },
  "usage": {
    "generations_used": 14,
    "generations_limit": 100,
    "reset_at": "2026-08-01T00:00:00Z"
  }
}
```

---

### 3. Generation & Refinement Endpoints (SSE)

```http
POST /api/generate
POST /api/generate/retry
POST /api/refine
```

#### `POST /api/generate` (SSE Stream)
- **Request Body**:
  ```json
  {
    "prompt": "Announcing our new summer product line!",
    "platforms": ["twitter", "linkedin", "instagram"],
    "imageKey": "uploads/img_4412.jpg"
  }
  ```
- **Stream Frames**:
  ```http
  event: stage1
  data: {"status":"vision_analyzing"}

  event: platform
  data: {"platformId":"twitter","content":"Excited to launch our new summer collection! ☀️ #SummerLaunch"}

  event: done
  data: {"campaignId":"cmp_882910"}
  ```

---

### 4. Brand Kit Endpoints

```http
GET /api/brand-kit
PUT /api/brand-kit
DELETE /api/brand-kit
GET /api/brand-kit?assetKey=uploads/...
```

---

## Evidence & Verification

| Claim / Behavior | Evidence Source | Verification Link / Code | Verified By | Last Verified |
| :--- | :--- | :--- | :--- | :--- |
| Auth middleware sets `pm_session` cookie | Auth Middleware | [`worker/src/middleware/auth.ts#L20-L45`](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/worker/src/middleware/auth.ts#L20-L45) | Backend Lead | 2026-07-31 |
| Brand Kit stream verifies owner key | Route Handler | [`worker/src/routes/brand-kit.ts#L80-L105`](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/worker/src/routes/brand-kit.ts#L80-L105) | Backend Lead | 2026-07-31 |

---

## Living Status & Technical Debt

### Open Questions
- [ ] Should we add rate-limiting headers (`X-RateLimit-Remaining`) to all API responses?

### Known Limitations
- Campaigns in D1 currently store `has_image`/`has_video` boolean flags rather than full image URLs.
