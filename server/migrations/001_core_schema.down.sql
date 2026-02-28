ALTER TABLE IF EXISTS admin_users
  DROP CONSTRAINT IF EXISTS admin_users_role_check;

ALTER TABLE IF EXISTS cv_records
  DROP CONSTRAINT IF EXISTS cv_records_snapshot_object_check;

ALTER TABLE IF EXISTS agencies
  DROP CONSTRAINT IF EXISTS agencies_templates_array_check,
  DROP CONSTRAINT IF EXISTS agencies_profile_object_check,
  DROP CONSTRAINT IF EXISTS agencies_last_reset_month_check,
  DROP CONSTRAINT IF EXISTS agencies_subscription_status_check,
  DROP CONSTRAINT IF EXISTS agencies_cvs_created_check,
  DROP CONSTRAINT IF EXISTS agencies_cv_limit_check,
  DROP CONSTRAINT IF EXISTS agencies_plan_check;

DROP INDEX IF EXISTS idx_cv_records_agency_created_at;
DROP INDEX IF EXISTS idx_api_rate_limits_expires_at;

DROP TABLE IF EXISTS api_rate_limits;
DROP TABLE IF EXISTS admin_users;
