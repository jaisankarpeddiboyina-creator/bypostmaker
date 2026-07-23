-- ============================================================
-- PostMaker D1 Schema — Final Version
-- ============================================================
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── Users ────────────────────────────────────────────────────
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
  password_hash   TEXT,
  email_verified  INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google   ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_role     ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_plan     ON users(plan);

-- ── Subscriptions ─────────────────────────────────────────────
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

-- ── Promo Codes ───────────────────────────────────────────────
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

-- ── Usage ─────────────────────────────────────────────────────
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

-- ── Campaigns ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt          TEXT NOT NULL,
  original_prompt TEXT NOT NULL,
  platforms       TEXT NOT NULL,
  has_image       INTEGER NOT NULL DEFAULT 0,
  image_key       TEXT,
  has_video       INTEGER NOT NULL DEFAULT 0,
  video_filename  TEXT,
  status          TEXT NOT NULL DEFAULT 'generating'
                  CHECK (status IN ('generating','completed','failed')),
  generated_count INTEGER NOT NULL DEFAULT 0,
  image_description TEXT,                        -- Stage 1 Gemini vision output; NULL = no image or Stage 1 not yet run
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_campaigns_user    ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_created ON campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_status  ON campaigns(status);

-- ── Generated Posts ───────────────────────────────────────────
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

-- ── API Keys (v2 foundation) ──────────────────────────────────
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

-- ── DB Health Log ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS db_health_log (
  id          TEXT PRIMARY KEY,
  table_name  TEXT NOT NULL,
  row_count   INTEGER NOT NULL,
  checked_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ── Password Resets ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_resets (
  email       TEXT PRIMARY KEY,
  token       TEXT NOT NULL,
  expires_at  INTEGER NOT NULL
);

-- ── Email Verifications ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_verifications (
  email       TEXT PRIMARY KEY,
  token       TEXT NOT NULL,
  expires_at  INTEGER NOT NULL
);

-- ── System Settings ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ── Brand Kits ────────────────────────────────────────────────
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
  platform_links    TEXT NOT NULL DEFAULT '[]',
  products_services TEXT NOT NULL DEFAULT '',
  target_audience   TEXT NOT NULL DEFAULT '',
  competitors       TEXT NOT NULL DEFAULT '',
  brand_guidelines  TEXT NOT NULL DEFAULT '',
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at        INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_brand_kits_user ON brand_kits(user_id);

