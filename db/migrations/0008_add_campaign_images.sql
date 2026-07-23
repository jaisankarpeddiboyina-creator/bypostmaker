-- Migration 0008: Add campaign_images child table
-- Supports multi-image campaigns (up to 4 images per campaign)
-- Stores object keys in R2 alongside sequence order.
-- Legacy single-image campaigns continue using campaigns.image_key (nullable).

CREATE TABLE IF NOT EXISTS campaign_images (
  id          TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_key   TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_camp_images_campaign ON campaign_images(campaign_id);
CREATE INDEX IF NOT EXISTS idx_camp_images_user     ON campaign_images(user_id);
