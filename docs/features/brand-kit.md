---
id: DOC-2026-005
title: Brand Kit Manager Architecture & Feature Spec
category: Feature
status: Stable
owner: Product Engineering Lead
created_at: 2026-07-31
last_updated: 2026-07-31
version: 1.0.0
breaking_changes: No
migration_needed: No
compatible_since: v1.0.0
deprecated_since: N/A
---

# Brand Kit Manager Architecture & Feature Spec

## Documentation Relationships

- **Depends On**:
  - [DOC-2026-001: System Architecture](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/docs/architecture/system-overview.md)
  - [DOC-2026-002: API Contract Spec](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/docs/api/postmaker-api-contract.md)
  - [DOC-2026-003: D1 Database Schema](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/docs/database/d1-schema-spec.md)
- **Used By**:
  - Brand Kit Page ([`frontend/src/pages/BrandKitPage.tsx`](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/frontend/src/pages/BrandKitPage.tsx))

---

## AI Context & Guardrails

> [!IMPORTANT]
> **Operational Guardrails for AI Agents**

- **Purpose**: Manage brand voice, colors, typography, logos, platform profile links, target audience, and guidelines.
- **Inputs**: HTTP `GET`, `PUT`, `DELETE` requests to `/api/brand-kit`. JSON payload & logo R2 asset keys.
- **Outputs**: Stored brand kit record in D1 `brand_kits` table; R2 streaming logo binaries.
- **Dependencies**: D1 table `brand_kits`, R2 bucket binding `env.BUCKET`, Zustand store `useBrandKitStore`.
- **Business Rules**: 1 primary Brand Kit per user in v1. Asset streaming (`GET /api/brand-kit?assetKey=...`) MUST verify that `assetKey` belongs to the requesting user's saved logo key.
- **DO NOT CHANGE**: Owner-verification security check on asset streaming; JSON export/import compatibility schema.

---

## Feature Capabilities & Matrix

| Sub-Feature | Implementation File | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Multi-Platform Link Manager** | [`frontend/src/pages/BrandKitPage.tsx`](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/frontend/src/pages/BrandKitPage.tsx) | `CONFIRMED WORKING` | Supports all 33 social platforms. |
| **Logo R2 Asset Stream** | [`worker/src/routes/brand-kit.ts`](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/worker/src/routes/brand-kit.ts) | `CONFIRMED WORKING` | Owner-verified streaming from R2 storage. |
| **JSON Export & Import** | [`frontend/src/pages/BrandKitPage.tsx`](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/frontend/src/pages/BrandKitPage.tsx) | `CONFIRMED WORKING` | Client-side JSON backup & restore modal. |
| **Post Generation Injection** | [`worker/src/routes/generate.ts`](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/worker/src/routes/generate.ts) | `DORMANT` | Brand kit saves its data; injection into AI prompt pipeline deferred to v2. |

---

## Evidence & Verification

| Claim / Behavior | Evidence Source | Verification Link / Code | Verified By | Last Verified |
| :--- | :--- | :--- | :--- | :--- |
| D1 table schema migration 0007 | D1 SQL Migration | [`db/migrations/0007_extend_brand_kit.sql`](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/db/migrations/0007_extend_brand_kit.sql) | Lead DB Architect | 2026-07-31 |
| Brand Kit REST endpoints implementation | Worker Route Handler | [`worker/src/routes/brand-kit.ts`](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/worker/src/routes/brand-kit.ts) | Backend Lead | 2026-07-31 |
