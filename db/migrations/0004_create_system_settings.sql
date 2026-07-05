-- Migration 0004: Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Seed default retention days
INSERT OR REPLACE INTO system_settings (key, value) VALUES ('retention_days_free', '7');
INSERT OR REPLACE INTO system_settings (key, value) VALUES ('retention_days_paid', '30');
