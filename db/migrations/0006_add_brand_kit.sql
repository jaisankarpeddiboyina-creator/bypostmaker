-- Migration 0006: Add brand_kits table
CREATE TABLE IF NOT EXISTS brand_kits (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL DEFAULT 'Default Brand',
  is_default        INTEGER NOT NULL DEFAULT 1,
  logo_object_key   TEXT,
  logo_dark_key     TEXT,
  logo_icon_key     TEXT,
  colors            TEXT NOT NULL DEFAULT '{"primary":"#F72585","secondary":"#9333EA","accent":"#00E5A3","dark":"#0F172A","gray":"#64748B","light":"#F8FAFC"}',
  fonts             TEXT NOT NULL DEFAULT '{"heading":{"family":"Plus Jakarta Sans","weight":"700"},"body":{"family":"Plus Jakarta Sans","weight":"400"},"accent":{"family":"Great Vibes","weight":"400"}}',
  voice             TEXT NOT NULL DEFAULT '{"tone":"Friendly, Confident","language":"English (US)","dos":"Use positive words, short sentences, emojis","donts":"Avoid complex jargon, negative words"}',
  social_links      TEXT NOT NULL DEFAULT '{"instagram":"","facebook":"","twitter":"","linkedin":"","website":""}',
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at        INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_brand_kits_user ON brand_kits(user_id);
