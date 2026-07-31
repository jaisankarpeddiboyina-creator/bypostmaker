---
id: DOC-2026-003
title: Cloudflare D1 Database Schema Specification
category: Database
status: Stable
owner: Database Architect
created_at: 2026-07-31
last_updated: 2026-07-31
version: 1.0.0
breaking_changes: No
migration_needed: No
compatible_since: v1.0.0
deprecated_since: N/A
---

# Cloudflare D1 Database Schema Specification

## Documentation Relationships

- **Depends On**:
  - [DOC-2026-001: System Architecture](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/docs/architecture/system-overview.md)
- **Used By**:
  - [DOC-2026-002: API Contract Spec](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/docs/api/postmaker-api-contract.md)
  - [DOC-2026-005: Brand Kit Manager Architecture](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/docs/features/brand-kit.md)

---

## AI Context & Guardrails

> [!IMPORTANT]
> **Operational Guardrails for AI Agents**

- **Purpose**: Schema specification for Cloudflare D1 SQLite database (`postmaker-db`).
- **Inputs**: Migration SQL scripts located in [`db/migrations/`](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/db/migrations).
- **Outputs**: D1 tables: `users`, `campaigns`, `posts`, `subscriptions`, `brand_kits`, `usage`.
- **Dependencies**: Cloudflare D1 CLI (`wrangler d1 migrations apply`).
- **Constraints**: SQLite dialect; case-sensitive column names in `snake_case`.
- **Business Rules**: `user_id` foreign key cascade deletes; `brand_kits` table enforces 1 primary kit per user.
- **DO NOT CHANGE**: Migration tag history order or primary key type (`TEXT` UUIDs).

---

## Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS ||--o{ CAMPAIGNS : "creates"
    USERS ||--o{ SUBSCRIPTIONS : "has"
    USERS ||--o| BRAND_KITS : "owns"
    CAMPAIGNS ||--|{ POSTS : "contains"

    USERS {
        text id PK
        text email
        text name
        text created_at
    }

    CAMPAIGNS {
        text id PK
        text user_id FK
        text prompt
        text image_description
        boolean has_image
        text created_at
    }

    POSTS {
        text id PK
        text campaign_id FK
        text platform
        text content
        text created_at
    }

    BRAND_KITS {
        text id PK
        text user_id FK
        text name
        text logo_object_key
        text colors
        text fonts
        text voice
        text platform_links
        text created_at
        text updated_at
    }
```

---

## Core Tables Overview

| Table Name | Description | Key Columns | Migration File |
| :--- | :--- | :--- | :--- |
| `users` | User accounts & OAuth profiles | `id`, `email`, `name`, `created_at` | `db/migrations/0001_initial.sql` |
| `campaigns` | Post generation campaigns | `id`, `user_id`, `prompt`, `image_description` | `db/migrations/0002_campaigns.sql` |
| `posts` | Multi-platform generated posts | `id`, `campaign_id`, `platform`, `content` | `db/migrations/0002_campaigns.sql` |
| `subscriptions` | Razorpay billing subscriptions | `id`, `user_id`, `plan`, `status` | `db/migrations/0004_billing.sql` |
| `brand_kits` | User brand voice & design assets | `id`, `user_id`, `colors`, `platform_links` | `db/migrations/0007_extend_brand_kit.sql` |

---

## Evidence & Verification

| Claim / Behavior | Evidence Source | Verification Link / Code | Verified By | Last Verified |
| :--- | :--- | :--- | :--- | :--- |
| Migration 0007 adds `platform_links` | SQL Migration File | [`db/migrations/0007_extend_brand_kit.sql#L1-L10`](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/db/migrations/0007_extend_brand_kit.sql#L1-L10) | Database Lead | 2026-07-31 |
| Dev D1 database binding name is `postmaker-db-dev` | Config File | [`wrangler.toml#L64`](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/wrangler.toml#L64) | DevOps Lead | 2026-07-31 |
