ALTER TABLE agencies
  ADD COLUMN IF NOT EXISTS onboarding_step TEXT NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS onboarding_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

UPDATE agencies
SET onboarding_step = 'completed'
WHERE onboarding_step IS NULL OR onboarding_step = '';

UPDATE agencies
SET onboarding_state = '{}'::jsonb
WHERE onboarding_state IS NULL OR jsonb_typeof(onboarding_state) <> 'object';

UPDATE agencies
SET onboarding_completed_at = COALESCE(onboarding_completed_at, created_at, NOW())
WHERE onboarding_step = 'completed';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agencies_onboarding_step_check'
  ) THEN
    ALTER TABLE agencies
      ADD CONSTRAINT agencies_onboarding_step_check
      CHECK (onboarding_step IN ('welcome', 'profile', 'checklist', 'completed'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agencies_onboarding_state_object_check'
  ) THEN
    ALTER TABLE agencies
      ADD CONSTRAINT agencies_onboarding_state_object_check
      CHECK (jsonb_typeof(onboarding_state) = 'object');
  END IF;
END
$$;
