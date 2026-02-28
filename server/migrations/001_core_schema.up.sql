CREATE TABLE IF NOT EXISTS agencies (
  id TEXT PRIMARY KEY,
  agency_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  plan TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  cv_limit INTEGER NOT NULL,
  cvs_created INTEGER NOT NULL DEFAULT 0,
  templates JSONB NOT NULL DEFAULT '[]'::jsonb,
  subscription_status TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT '',
  payment_reference TEXT NOT NULL DEFAULT '',
  payment_note TEXT NOT NULL DEFAULT '',
  last_reset_month TEXT NOT NULL,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE agencies
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_reference TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_note TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_reset_month TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM');

CREATE TABLE IF NOT EXISTS cv_records (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  candidate_name TEXT NOT NULL DEFAULT '',
  reference_no TEXT NOT NULL DEFAULT '',
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agency_id, idempotency_key)
);

ALTER TABLE cv_records
  ADD COLUMN IF NOT EXISTS snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_rate_limits (
  bucket_key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (bucket_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_cv_records_agency_created_at
  ON cv_records (agency_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_expires_at
  ON api_rate_limits (expires_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agencies_plan_check'
  ) THEN
    ALTER TABLE agencies
      ADD CONSTRAINT agencies_plan_check
      CHECK (plan IN ('free', 'starter', 'growth', 'enterprise'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agencies_cv_limit_check'
  ) THEN
    ALTER TABLE agencies
      ADD CONSTRAINT agencies_cv_limit_check
      CHECK (cv_limit >= 0);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agencies_cvs_created_check'
  ) THEN
    ALTER TABLE agencies
      ADD CONSTRAINT agencies_cvs_created_check
      CHECK (cvs_created >= 0);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agencies_subscription_status_check'
  ) THEN
    ALTER TABLE agencies
      ADD CONSTRAINT agencies_subscription_status_check
      CHECK (subscription_status IN ('active', 'pending_approval', 'pending_payment', 'suspended', 'cancelled'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agencies_last_reset_month_check'
  ) THEN
    ALTER TABLE agencies
      ADD CONSTRAINT agencies_last_reset_month_check
      CHECK (last_reset_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agencies_profile_object_check'
  ) THEN
    ALTER TABLE agencies
      ADD CONSTRAINT agencies_profile_object_check
      CHECK (jsonb_typeof(profile) = 'object');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agencies_templates_array_check'
  ) THEN
    ALTER TABLE agencies
      ADD CONSTRAINT agencies_templates_array_check
      CHECK (jsonb_typeof(templates) = 'array');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cv_records_snapshot_object_check'
  ) THEN
    ALTER TABLE cv_records
      ADD CONSTRAINT cv_records_snapshot_object_check
      CHECK (jsonb_typeof(snapshot) = 'object');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_users_role_check'
  ) THEN
    ALTER TABLE admin_users
      ADD CONSTRAINT admin_users_role_check
      CHECK (role IN ('admin', 'super_admin'));
  END IF;
END
$$;
