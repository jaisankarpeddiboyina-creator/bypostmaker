-- Migration: 0012_omnipost_phase1.sql
-- Description: Omnipost Phase 1 tables for single-connection Discord webhooks and atomic idempotency delivery tracking

CREATE TABLE IF NOT EXISTS omnipost_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  encrypted_config TEXT,
  wrapped_key TEXT,
  key_id TEXT,
  alg TEXT,
  is_plaintext INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_omnipost_connections_user ON omnipost_connections(user_id);

CREATE TABLE IF NOT EXISTS omnipost_deliveries (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  platform_post_id TEXT,
  url TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (connection_id) REFERENCES omnipost_connections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_omnipost_deliveries_user ON omnipost_deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_omnipost_deliveries_created ON omnipost_deliveries(created_at);
