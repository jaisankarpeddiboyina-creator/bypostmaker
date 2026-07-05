-- Migration 0003: Add campaigns.image_key column
ALTER TABLE campaigns ADD COLUMN image_key TEXT;
