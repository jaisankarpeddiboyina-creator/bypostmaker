-- Add password_hash and email_verified columns
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;

-- Mark existing Google OAuth users as verified
UPDATE users SET email_verified = 1 WHERE google_id IS NOT NULL;

-- Password resets table
CREATE TABLE IF NOT EXISTS password_resets (
  email       TEXT PRIMARY KEY,
  token       TEXT NOT NULL,
  expires_at  INTEGER NOT NULL
);

-- Email verifications table
CREATE TABLE IF NOT EXISTS email_verifications (
  email       TEXT PRIMARY KEY,
  token       TEXT NOT NULL,
  expires_at  INTEGER NOT NULL
);
