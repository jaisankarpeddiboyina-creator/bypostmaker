-- ── System Logs Table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_logs (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL CHECK(type IN ('error', 'event', 'info')),
  level       TEXT NOT NULL CHECK(level IN ('debug', 'info', 'warn', 'error', 'fatal')),
  user_id     TEXT,
  message     TEXT NOT NULL,
  context     TEXT, -- JSON metadata
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_type ON system_logs(type);
