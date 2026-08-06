---
id: DOC-ARCH
title: PostMaker Consolidated System Architecture & Specs
category: Architecture
status: Stable
owner: Tech Lead
created_at: 2026-08-05
last_updated: 2026-08-05
version: 1.0.0
breaking_changes: No
migration_needed: No
compatible_since: v1.0.0
deprecated_since: N/A
---

# 🏛️ PostMaker — System Architecture & Technical Specifications

Consolidated technical specification covering System Overview, AI Pipeline, API Contracts, D1 Schema, and Design System.

---

## 1. 🏗️ Tech Stack & Overview

- **Frontend**: React 18, Vite, React Router DOM v6, Zustand (`frontend/src/store/app.ts`), Vanilla CSS (`globals.css`).
- **Backend Worker**: Cloudflare Workers (`wrangler`), TypeScript runtime (`workerd`).
- **AI Engine**: Vercel AI SDK (`@ai-sdk/google`, `@ai-sdk/groq`), Cloudflare AI Gateway (`postmaker-gateway`).
- **Storage & Database**: Cloudflare R2 Bucket (`postmaker-uploads`), Cloudflare D1 SQLite Database (`postmaker-db`).

---

## 2. ⚡ Two-Stage AI Generation Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor User as Client Browser
    participant Worker as Cloudflare Worker (generate.ts)
    participant Gateway as CF AI Gateway (postmaker-gateway)
    participant Gemini as Stage 1: Gemini 2.5 Flash
    participant D1 as D1 Database
    participant Groq as Stage 2: Groq (Llama 3.3 / 3.1)

    User->>Worker: POST /api/generate (prompt, platformIds, imageKeys[])
    Worker-->>User: SSE Header (200 OK, text/event-stream)
    
    opt Has Images
        Worker->>Gateway: Stage 1 Vision Request (Image ArrayBuffers)
        Gateway->>Gemini: Process Vision Analysis
        Gemini-->>Worker: Return JSON Image Description
        Worker->>D1: UPDATE campaigns SET image_description = ?
    end

    par Parallel Platform Group Streams
        Worker->>Gateway: Stage 2 Text Generation Request
        Gateway->>Groq: Generate Platform Captions
        Groq-->>Worker: Streamed Content
        Worker-->>User: event: platform { platformId, content }
    end
    Worker-->>User: event: done
```

- **Stage 1 (Vision)**: `analyzeImage(env, imagePayloads)` calls `gemini-2.5-flash` ONCE to extract structured JSON (subjects, mood, setting, colors, details).
- **Stage 2 (Text)**: `streamGenerate` injects `image_description` into prompt text and generates platform captions in parallel via Groq.

---

## 3. 🔌 API Contract Summary

- `POST /api/generate`: SSE stream endpoint returning `start`, `init`, `vision`, `platform`, `done`, and `fatal` events.
- `POST /api/upload/presign-batch`: Generates presigned S3 R2 upload URLs for client image uploads.
- `GET /api/auth/dev`: Development mode authentication bypass (returns `pm_session` cookie).

---

## 4. 🗄️ Cloudflare D1 Database Schema Summary

- `users`: `id`, `email`, `name`, `plan` (`free` | `starter` | `pro` | `business`), `created_at`.
- `campaigns`: `id`, `user_id`, `prompt`, `image_description`, `created_at`.
- `posts`: `id`, `campaign_id`, `platform_id`, `content`, `status`, `created_at`.
- `brand_kits`: `id`, `user_id`, `name`, `voice`, `brand_guidelines`, `updated_at`.

---

## 5. 🎨 Design System Tokens (`frontend/src/styles/globals.css`)

- **Primary Colors**: `var(--color-primary-start)` (`#38BDF8`), `var(--color-primary-end)` (`#0284C7`).
- **Liquid Glass Surfaces**: `var(--color-surface)` (`rgba(15, 28, 48, 0.58)` + `backdrop-filter: blur(36px)`).
- **Borders & Shadows**: `var(--color-border)` (`rgba(255, 255, 255, 0.22)`), `var(--shadow-card)`.
