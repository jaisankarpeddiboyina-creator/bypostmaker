-- Migration: 0015_omnipost_claims.sql
-- Description: Add omnipost_claims table for cross-isolate dispatch locking.
--   D1 INSERT OR IGNORE on claim_key (PRIMARY KEY) provides atomic claim
--   acquisition across all Worker isolates in a single D1 region.
--   expires_at is Unix epoch milliseconds (matches Date.now() / CLAIM_TTL_MS).
--
-- Future risk: not a true distributed lock if D1 ever becomes multi-region
--   replicated. Acceptable for current single-region D1 architecture.
--   Tracked follow-up: migrate to Durable Objects if cross-region isolation
--   becomes a requirement.

CREATE TABLE IF NOT EXISTS omnipost_claims (
  claim_key  TEXT    PRIMARY KEY,  -- "{postId}:{platformId}" composite key
  expires_at INTEGER NOT NULL      -- Unix epoch milliseconds
);

-- Index for fast TTL cleanup (DELETE WHERE expires_at <= ?)
CREATE INDEX IF NOT EXISTS idx_claims_expires
  ON omnipost_claims(expires_at);
