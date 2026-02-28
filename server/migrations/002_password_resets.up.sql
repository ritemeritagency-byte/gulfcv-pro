CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_agency_created_at
  ON password_resets (agency_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_password_resets_expires_unused
  ON password_resets (expires_at)
  WHERE used_at IS NULL;
