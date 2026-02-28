# GulfCV Pro Production Runbook

This checklist is ordered for safe rollout. Items marked `Code` are now implemented in this repo. Items marked `Ops` require deployment/platform actions.

## 1) Critical security and data risks

- `Code` Admin UI moved from shared `x-admin-key` to authenticated admin session flow.
- `Code` Admin list rendering no longer injects raw HTML from DB values.
- `Code` Agency session moved to HttpOnly cookies (`/api/auth/login`, `/api/auth/signup` set session cookies).
- `Code` CV counting is transactional with row lock + idempotency to prevent overcount race conditions.

## 2) Admin auth model

- `Code` Added `admin_users` table and admin auth endpoints:
  - `POST /api/admin/auth/login`
  - `GET /api/admin/auth/me`
  - `POST /api/admin/auth/logout`
- `Code` Protected admin actions with signed admin session cookie.
- `Ops` Set `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` for initial secure admin bootstrap.

## 3) Real DB migrations + rollback

- `Code` Added migration system with tracking table `schema_migrations`.
- `Code` Migration scripts:
  - `npm run migrate`
  - `npm run migrate:status`
  - `npm run migrate:down -- --steps 1`
- `Code` Startup now runs pending migrations automatically before serving traffic.

## 4) Indexes and integrity constraints

- `Code` Added schema constraints for plan/status/quota fields and JSON shapes.
- `Code` Added indexed history path:
  - `idx_cv_records_agency_created_at (agency_id, created_at DESC)`

## 5) Business rule enforcement server-side

- `Code` CV creation now rejects non-active subscriptions (`403 Subscription is not active`).
- `Code` Enforcement is at API layer; frontend is not trusted for this rule.

## 6) Edge hardening

- `Code` Added CSP meta policy on app pages.
- `Code` API security headers set (`X-Frame-Options`, HSTS in production, etc.).
- `Ops` Also enforce security headers at CDN/reverse-proxy for static assets.
- `Ops` Serve both frontend and API over HTTPS only.

## 7) Production-grade distributed rate limiting

- `Code` Added rate limiter store modes:
  - `RATE_LIMIT_STORE=postgres` (recommended for multi-instance)
  - `RATE_LIMIT_STORE=memory` (local/dev fallback)
- `Code` Rate limiter persists counters in `api_rate_limits` for shared-instance behavior.

## 8) Observability and readiness

- `Code` Structured JSON request logs with request IDs.
- `Code` `GET /api/health` now checks DB readiness and reports DB latency.
- `Ops` Forward logs to centralized sink (e.g., Datadog/ELK/Cloud logging) and alert on 5xx spikes + health failures.

## 9) Automated tests

- `Code` Added integration test entrypoint: `server/tests/api.integration.test.js`.
- `Code` Coverage includes auth session flow, idempotent CV counting, subscription gate, admin activation, health.
- `Code` Tests auto-skip when `TEST_DATABASE_URL` is not provided.
- `Ops` Provide dedicated test Postgres for CI integration execution.

## 10) CI/CD + environment separation

- `Code` Added GitHub Actions CI: `.github/workflows/ci.yml`.
- `Code` Added env templates:
  - `server/.env.example`
  - `server/.env.staging.example`
  - `server/.env.production.example`
- `Ops` Configure separate staging and production secrets/stacks and promote only from green staging builds.

## 11) Final pre-launch checklist

- `Ops` Create and verify automated Postgres backups + restore drill.
- `Ops` Confirm admin bootstrap credentials rotated after first login.
- `Ops` Run load test against staging with production-like DB size.
- `Ops` Verify CORS origins and cookie domain/samesite values in production env.
- `Ops` Confirm rollback path:
  1. Deploy previous app image
  2. If needed, run `npm run migrate:down -- --steps 1` only for reversible migration cases
  3. Validate `/api/health` and key user flows

## 12) Password reset flow

- `Code` Added password reset endpoints:
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/reset-password`
- `Code` Uses one-time hashed reset tokens with expiry (default 30 minutes).
- `Ops` Configure delivery mode:
  - `PASSWORD_RESET_DELIVERY=log` for local/staging testing.
  - `PASSWORD_RESET_DELIVERY=resend` with `RESEND_API_KEY` and `RESEND_FROM_EMAIL` for production email delivery.
- `Ops` Set `PASSWORD_RESET_URL_BASE` to your frontend domain (for reset links).

---

## Quick commands

```bash
# Backend checks
cd server
npm run check
npm test

# Migration status
npm run migrate:status
```
