-- Migration 0001: Initial schema
-- This file mirrors db/schema.sql for the migrations system.

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  avatar_url      TEXT,
  google_id       TEXT NOT NULL UNIQUE,
  plan            TEXT NOT NULL DEFAULT 'free'
                  CHECK (plan IN ('free','starter','pro','business')),
  plan_status     TEXT NOT NULL DEFAULT 'active'
                  CHECK (plan_status IN ('active','cancelled','past_due')),
  role            TEXT NOT NULL DEFAULT 'user'
                  CHECK (role IN ('user','beta','admin')),
  disabled        INTEGER NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'usd'
                  CHECK (currency IN ('usd','inr')),
  referred_by     TEXT REFERENCES users(id),
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google   ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_role     ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_plan     ON users(plan);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  razorpay_sub_id       TEXT UNIQUE,
  razorpay_customer_id  TEXT,
  plan                  TEXT NOT NULL CHECK (plan IN ('starter','pro','business')),
  currency              TEXT NOT NULL DEFAULT 'usd' CHECK (currency IN ('usd','inr')),
  status                TEXT NOT NULL DEFAULT 'created'
                        CHECK (status IN ('created','authenticated','active','pending','halted','cancelled','completed','expired')),
  promo_code            TEXT REFERENCES promo_codes(code),
  current_period_start  INTEGER,
  current_period_end    INTEGER,
  cancelled_at          INTEGER,
  created_at            INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at            INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_subs_user   ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subs_rzp    ON subscriptions(razorpay_sub_id);
CREATE INDEX IF NOT EXISTS idx_subs_status ON subscriptions(status);

CREATE TABLE IF NOT EXISTS promo_codes (
  code            TEXT PRIMARY KEY,
  description     TEXT,
  discount_pct    INTEGER NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
  max_uses        INTEGER,
  uses            INTEGER NOT NULL DEFAULT 0,
  valid_from      INTEGER NOT NULL DEFAULT (unixepoch()),
  valid_until     INTEGER,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS usage (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start  INTEGER NOT NULL,
  period_end    INTEGER NOT NULL,
  generations   INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_user   ON usage(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_period ON usage(user_id, period_start);

CREATE TABLE IF NOT EXISTS campaigns (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt          TEXT NOT NULL,
  original_prompt TEXT NOT NULL,
  platforms       TEXT NOT NULL,
  has_image       INTEGER NOT NULL DEFAULT 0,
  has_video       INTEGER NOT NULL DEFAULT 0,
  video_filename  TEXT,
  status          TEXT NOT NULL DEFAULT 'generating'
                  CHECK (status IN ('generating','completed','failed')),
  generated_count INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_campaigns_user    ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_created ON campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_status  ON campaigns(status);

CREATE TABLE IF NOT EXISTS generated_posts (
  id            TEXT PRIMARY KEY,
  campaign_id   TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform_id   TEXT NOT NULL,
  content       TEXT NOT NULL,
  extra_fields  TEXT,
  edited        INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(campaign_id, platform_id)
);

CREATE INDEX IF NOT EXISTS idx_posts_campaign  ON generated_posts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_posts_user      ON generated_posts(user_id);

CREATE TABLE IF NOT EXISTS api_keys (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash      TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  last_used_at  INTEGER,
  expires_at    INTEGER,
  revoked       INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_apikeys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_apikeys_hash ON api_keys(key_hash);

CREATE TABLE IF NOT EXISTS db_health_log (
  id          TEXT PRIMARY KEY,
  table_name  TEXT NOT NULL,
  row_count   INTEGER NOT NULL,
  checked_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
