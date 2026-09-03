-- Migration 0011: Create shares table for public read-only shared links
CREATE TABLE IF NOT EXISTS shares (
  id                TEXT PRIMARY KEY,              -- 21-char URL-safe Nanoid
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id       TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  content_snapshot  TEXT NOT NULL,                 -- JSON array of posts
  media_keys        TEXT,                          -- JSON array of R2 keys, nullable
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at        INTEGER NOT NULL               -- created_at + 172800 (48h)
);

CREATE INDEX IF NOT EXISTS idx_shares_expires_at  ON shares(expires_at);
CREATE INDEX IF NOT EXISTS idx_shares_user_id     ON shares(user_id);
CREATE INDEX IF NOT EXISTS idx_shares_campaign_id ON shares(campaign_id);
