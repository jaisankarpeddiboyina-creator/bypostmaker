-- ============================================================
-- PostMaker D1 Migration 0010 — Assets Library
-- Adds: asset_folders, assets
-- NOT included: connected_drives (deferred to migration 0011
--   pending a separate token-encryption design decision)
-- ============================================================
-- ROLLBACK: DROP TABLE IF EXISTS assets; DROP TABLE IF EXISTS asset_folders;
-- ============================================================

PRAGMA foreign_keys = ON;

-- ── Asset Folders ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS asset_folders (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_asset_folders_user ON asset_folders(user_id);

-- ── Assets ────────────────────────────────────────────────────
-- Exactly one of r2_key or external_url must be set per row.
-- r2_key   → device upload stored in Cloudflare R2
-- external_url → free media URL reference (not copied to R2)
-- provider values: 'upload' | 'free_media'
-- type     values: image | video | audio | font | icon | svg | doc
-- attr_*   → attribution required by some providers (e.g. Unsplash).
--            Stored flat for efficient reads; no JSON column.
CREATE TABLE IF NOT EXISTS assets (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id       TEXT REFERENCES asset_folders(id) ON DELETE SET NULL,
  type            TEXT NOT NULL CHECK (type IN ('image','video','audio','font','icon','svg','doc')),
  name            TEXT NOT NULL,
  r2_key          TEXT,
  external_url    TEXT,
  provider        TEXT NOT NULL DEFAULT 'upload',
  mime_type       TEXT,
  file_size       INTEGER,
  width           INTEGER,
  height          INTEGER,
  attr_author     TEXT,
  attr_author_url TEXT,
  attr_source_url TEXT,
  is_favorite     INTEGER NOT NULL DEFAULT 0,
  is_trashed      INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_assets_user     ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_folder   ON assets(folder_id);
CREATE INDEX IF NOT EXISTS idx_assets_type     ON assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_fav      ON assets(user_id, is_favorite);
CREATE INDEX IF NOT EXISTS idx_assets_trashed  ON assets(user_id, is_trashed);
CREATE INDEX IF NOT EXISTS idx_assets_created  ON assets(user_id, created_at DESC);
