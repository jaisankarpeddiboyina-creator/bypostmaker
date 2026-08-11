-- ── User Feedback ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback (
  id          TEXT PRIMARY KEY,  -- UUID generated via crypto.randomUUID()
  user_id     TEXT,              -- references users(id) ON DELETE SET NULL, NULL if guest
  user_email  TEXT,              -- email address (optional for guest, automatic for logged-in user)
  category    TEXT NOT NULL CHECK(category IN ('bug', 'feature-request', 'general')),
  rating      INTEGER CHECK(rating IS NULL OR (rating >= 1 AND rating <= 5)),
  message     TEXT NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);
