-- Migration: 0013_omnipost_phase3.sql
-- Description: Transition omnipost_connections schema to use secret_blob and display_metadata, and migrate existing Discord webhook rows.

-- 1. Create the new temporary table with the updated columns
CREATE TABLE IF NOT EXISTS omnipost_connections_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  secret_blob TEXT NOT NULL, -- always encrypted credentials (tokens, secrets, or webhook URLs)
  display_metadata TEXT,    -- always plaintext JSON metadata (status, username, label, refresh lock)
  wrapped_key TEXT,         -- DEK wrapped by KEK
  key_id TEXT,              -- KEK version ID
  alg TEXT,                 -- encryption algorithm
  is_plaintext INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 2. Migrate existing connections from omnipost_connections to omnipost_connections_new.
-- Discord webhooks were storing their encrypted URL inside webhook_url. We map webhook_url to secret_blob,
-- and construct a default display_metadata JSON indicating an active connection.
-- The frontend will dynamically derive the default label (e.g. "Discord" or "Slack") from the platform type.
INSERT INTO omnipost_connections_new (
  id, user_id, platform, secret_blob, display_metadata, wrapped_key, key_id, alg, is_plaintext, created_at
)
SELECT 
  id, 
  user_id, 
  platform, 
  webhook_url, 
  '{"status":"active"}' AS display_metadata, 
  wrapped_key, 
  key_id, 
  alg, 
  is_plaintext, 
  created_at 
FROM omnipost_connections;

-- 3. Drop the old table
DROP TABLE IF EXISTS omnipost_connections;

-- 4. Rename the new table
ALTER TABLE omnipost_connections_new RENAME TO omnipost_connections;

-- 5. Recreate indices to keep search performance optimal
CREATE INDEX IF NOT EXISTS idx_omnipost_connections_user ON omnipost_connections(user_id);
