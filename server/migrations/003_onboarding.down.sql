ALTER TABLE IF EXISTS agencies
  DROP CONSTRAINT IF EXISTS agencies_onboarding_state_object_check,
  DROP CONSTRAINT IF EXISTS agencies_onboarding_step_check;

ALTER TABLE IF EXISTS agencies
  DROP COLUMN IF EXISTS onboarding_completed_at,
  DROP COLUMN IF EXISTS onboarding_state,
  DROP COLUMN IF EXISTS onboarding_step;
