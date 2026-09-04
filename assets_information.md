# Media Assets Library & Stock Free Media Marketplace — System Architecture

This document provides a comprehensive, end-to-end technical reference of the Media Assets Library and Free Stock Media system in PostMaker. It describes the database schema, backend API routes, rate-limiting Durable Objects, frontend state management, user interfaces, upload pipelines, and configuration keys.

---

## 🏛️ 1. Architecture Overview
The Assets Library is a full-stack system integrated into the PostMaker monorepo:
1. **Frontend (React 18 + Vite + Zustand)**:
   - **`AssetsPage.tsx`**: The main library management dashboard `/app/assets`.
   - **`AssetPickerModal.tsx`**: A unified picker modal allowing creators to select local uploads, search stock photos, or drag-and-drop new files during post generation.
   - **`app.ts`**: The Zustand store managing picker contexts, selection callbacks, and active lists.
2. **Backend (Cloudflare Workers + D1 + R2)**:
   - **`assets.ts`**: Worker REST controller handling folder CRUD, asset metadata indexing, secure file serving, and rate-limited stock media searches.
   - **`limiter.ts`**: A Cloudflare Durable Object (`GroqRateLimiter`) used to throttle stock API searches.
   - **`upload.ts`**: Accepts direct raw binary uploads and writes them directly to the R2 Storage bucket (`env.BUCKET`).

---

## 💾 2. D1 Database Schema
The SQLite database stores metadata for folders and assets. The schema is defined in [db/schema.sql](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/db/schema.sql) and applied via local/production migrations.

### A. Folders Table (`asset_folders`)
Stores user-created folders for categorizing assets.
```sql
CREATE TABLE asset_folders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_asset_folders_user ON asset_folders(user_id);
```

### B. Assets Table (`assets`)
Stores metadata of both uploaded physical files (R2) and external stock media references (Unsplash, Pexels).
```sql
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  folder_id TEXT, -- Nullable; reference to asset_folders.id
  type TEXT NOT NULL, -- 'image' | 'video' | 'icon' | 'font'
  name TEXT NOT NULL, -- Original filename or stock title
  r2_key TEXT, -- Nullable; R2 object key (e.g., 'uploads/userId/uuid.jpg') for uploaded files
  external_url TEXT, -- Nullable; direct download URL for stock media references
  provider TEXT NOT NULL DEFAULT 'upload', -- 'upload' | 'free_media'
  mime_type TEXT, -- Nullable; e.g. 'image/png'
  file_size INTEGER, -- Nullable; file size in bytes
  width INTEGER, -- Nullable; image width in pixels
  height INTEGER, -- Nullable; image height in pixels
  attr_author TEXT, -- Nullable; photographer's name
  attr_author_url TEXT, -- Nullable; photographer's portfolio URL
  attr_source_url TEXT, -- Nullable; original platform image page URL
  attr_provider_name TEXT, -- Nullable; platform name ('unsplash' | 'pexels')
  is_favorite INTEGER NOT NULL DEFAULT 0, -- Boolean flag (0 or 1)
  is_trashed INTEGER NOT NULL DEFAULT 0, -- Boolean flag (0 or 1) for soft-deletes
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_assets_user ON assets(user_id);
CREATE INDEX idx_assets_folder ON assets(folder_id);
CREATE INDEX idx_assets_favorite ON assets(is_favorite);
CREATE INDEX idx_assets_trashed ON assets(is_trashed);
```

---

## ⚡ 3. Cloudflare Durable Object Rate Limiter
To prevent abuse and key suspension of stock media search limits, API requests are throttled using the `GroqRateLimiter` Durable Object located in [worker/src/services/limiter.ts](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/worker/src/services/limiter.ts).

### A. Durable Object Extension
The DO intercepts requests on `/consume` to deduct slots in-memory and write token balances into persistent transactional state.
- **DO Key structure**: `assets:${providerId}:${userId}` (e.g., `assets:unsplash:user123`)
- **Limiter Limits**:
  - **Unsplash**: 15 requests per minute per user.
  - **Pexels**: 15 requests per minute per user.

### B. backend helper: `consumeAssetSlot`
Exported utility for worker route consumption:
```typescript
export async function consumeAssetSlot(
  env: Env,
  userId: string,
  providerId: string,
  limitPerMinute: number
): Promise<{ allowed: boolean; remaining: number }> {
  // If GROQ_LIMITER binding is missing, falls back to isolated in-memory lock
  const id = env.GROQ_LIMITER.idFromName(`assets:${providerId}:${userId}`);
  const obj = env.GROQ_LIMITER.get(id);
  const res = await obj.fetch(`http://limiter/consume?limit=${limitPerMinute}`);
  return res.json();
}
```

---

## 📡 4. Backend Worker API Routes
Backend endpoints are protected under the session-gated middleware in [worker/src/index.ts](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/worker/src/index.ts#L762) and routed via `handleAssetsRoute`.

### A. Folder Routes
- **`GET /api/assets/folders`**: Retrieves folders for the logged-in user.
- **`POST /api/assets/folders`**: Creates a folder. Payload: `{ name: string }`.
- **`DELETE /api/assets/folders/:id`**: Deletes folder `:id`. Assets inside this folder are *not* deleted; their `folder_id` is set to `NULL` (uncategorized root).

### B. Metadata Asset Routes
- **`GET /api/assets`**: Query parameters:
  - `type`: filter by type (`image`, `video`, `icon`, `font`).
  - `favorite`: filter by favorite status (`1` or `0`).
  - `trashed`: filter by soft-delete status (`1` or `0`, defaults to `0`).
  - `folder_id`: filter by folder ID (`root` for NULL, or specific folder uuid).
  - `q`: search query filter (`name LIKE %q%`).
  - `limit` & `page`: Pagination controls.
- **`POST /api/assets`**: Creates a new asset reference. Payload:
  ```json
  {
    "type": "image" | "video",
    "name": "filename.jpg",
    "r2_key": "uploads/userId/uuid.jpg", -- for uploads
    "external_url": "https://...", -- for stock references
    "provider": "upload" | "free_media",
    "mime_type": "image/jpeg",
    "file_size": 1024,
    "attribution": { -- optional
      "authorName": "John Doe",
      "authorUrl": "https://unsplash.com/@johndoe",
      "sourceUrl": "https://unsplash.com/photos/...",
      "providerName": "unsplash"
    }
  }
  ```
- **`PATCH /api/assets/:id`**: Soft-deletes or favorites an asset. Payload: `{ is_favorite?: number, is_trashed?: number, folder_id?: string | null }`.
- **`DELETE /api/assets/:id`**: Hard-deletes asset and deletes corresponding physical key from the R2 bucket (`env.BUCKET.delete(r2_key)`).

### C. Free Stock Media Search Route
- **`GET /api/assets/free-media?q=query&type=image&page=1`**:
  - Checks Durable Object search limit.
  - Queries provider registry (Unsplash, Pexels) in parallel.
  - Formats results into a unified stock item interface containing download links and author attribution.

### D. Secure Asset Serving Route
- **`GET /api/assets/serve?id=assetId`**:
  - Gated by ownership verify check (`SELECT r2_key FROM assets WHERE id = ? AND user_id = ?`).
  - Fetches binary payload from private bucket: `env.BUCKET.get(r2_key)`.
  - Streams chunk responses with correct `Content-Type` headers.

---

## 🛠️ 5. Local Direct Upload Pipeline
Direct file uploads bypass presigned URL roundtrips using the raw binary stream route `/api/upload/direct`:
1. **Frontend Trigger**: Upload actions trigger file selector inputs.
2. **R2 Upload**: The file is sent directly to `POST /api/upload/direct` with `'Content-Type': file.type`. The worker backend [upload.ts](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/worker/src/routes/upload.ts) stores the binary array buffer directly in the bucket:
   ```typescript
   await env.BUCKET.put(objectKey, body, { httpMetadata: { contentType } })
   ```
3. **Database Insertion**: On success, the worker returns `{ objectKey }`. The frontend immediately POSTs to `/api/assets` to write this `r2_key` and details into SQLite D1, linking the file to the creator's account.

---

## 🎛️ 6. Frontend Zustand State Store
Defined in [frontend/src/store/app.ts](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/frontend/src/store/app.ts):

```typescript
export interface AssetItem {
  id: string
  user_id: string
  folder_id: string | null
  type: string
  name: string
  r2_key: string | null
  external_url: string | null
  provider: string
  mime_type: string | null
  file_size: number | null
  width: number | null
  height: number | null
  is_favorite: number
  is_trashed: number
  created_at: number
  updated_at: number
  attribution: {
    authorName: string
    authorUrl: string
    sourceUrl: string
    providerName: string
  } | null
}

export interface AssetFolder {
  id: string
  name: string
  created_at: number
}

export interface AssetPickerContext {
  title?: string
  accept: string[] -- e.g. ['image'] or ['image', 'video']
  onSelect: (file: File) => void
}

// Store properties inside useAppStore:
showAssetPicker: boolean
assetPickerContext: AssetPickerContext | null
assets: AssetItem[]
assetFolders: AssetFolder[]

openAssetPicker: (context: AssetPickerContext) => void
closeAssetPicker: () => void
setAssets: (assets: AssetItem[]) => void
setAssetFolders: (folders: AssetFolder[]) => void
```

---

## 🖥️ 7. Frontend User Interfaces (UI)

### A. AssetPickerModal (`AssetPickerModal.tsx`)
A popup wrapper rendered at the root level of `App.tsx`.
- **Tabs**:
  - **My Assets**: Displays local assets with category filters and sidebar folders navigation.
  - **Free Media**: STOCK free media search panel. Performs search using `/api/assets/free-media` with local pagination. Selection downloads the image binary via `fetch(url)`, converts it to a browser `File` object (`new File([blob], filename, { type: blob.type })`), saves the reference database metadata ref via `POST /api/assets`, and feeds the file back to the editor payload.
  - **Upload**: Dropzone supporting click-to-browse or file drag-and-drop. Displays a visual progress bar.

### B. Library Hub (`AssetsPage.tsx`)
A full dashboard view mounted at route `/app/assets` with full CRUD operations:
- **Folders Sidebar**: Lists categories, favorites, and trash bin. Click to select active category.
- **Stock Free Media Search Integration**: Sidebar link called **"Free Stock Media"** loads stock search panel on click. Creators can search terms (e.g. `business`), browse stock, and click **"Save to Library"** to persist stock media into their library.
- **Direct Uploads**: Toolbar **"Upload File"** button uploads device media directly, writes metadata, and adds it to the active folder in real time.
- **Sorting & View Toggle**: Sort by recent, name, size, or type. Toggle layout style (grid vs list view).
- **Bulk Actions**: Select multiple assets to move to folders, move to trash bin, or hard-delete permanently.
- **Usage meter**: Progress bar illustrating R2 storage consumption (out of 500MB allowance).
- **Connected Drives teaser**: Visual placeholder for future integrations.

---

## 🔑 8. Environment Secrets & Settings
The system requires configuration bindings specified in the worker configuration:

- **Wrangler D1 Database**: Binding `DB` mapped to D1 database ID.
- **Wrangler R2 Bucket**: Binding `BUCKET` mapped to Cloudflare R2 bucket name.
- **Wrangler Durable Objects**: Binding `GROQ_LIMITER` mapped to `GroqRateLimiter` class.
- **Secrets (Wrangler secrets, *never* sent to client browser)**:
  - `UNSPLASH_ACCESS_KEY`: Access token for Unsplash Developers API search.
  - `PEXELS_API_KEY`: Authentication header key for Pexels search API.
