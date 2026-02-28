# Deployment Notes

## Environments

- `staging`: use `server/.env.staging.example` as template
- `production`: use `server/.env.production.example` as template

## Backend rollout order

1. Deploy code.
2. Set environment variables in host secret manager.
3. Run migrations:
   - `cd server`
   - `npm run migrate`
4. Start API:
   - `npm start`
5. Verify health:
   - `GET /api/health` returns `ok: true` and `db.ok: true`

## First admin bootstrap

1. Set `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD`.
2. Start API once so bootstrap admin is created.
3. Login at `admin.html`.
4. Rotate or remove bootstrap password env after verified access.

## Password reset email setup

1. Set `PASSWORD_RESET_URL_BASE` to your frontend origin (example: `https://gulf-cv-pro.vercel.app`).
2. For non-email testing, set `PASSWORD_RESET_DELIVERY=log`.
3. For production email, set:
   - `PASSWORD_RESET_DELIVERY=resend`
   - `RESEND_API_KEY=<your_resend_api_key>`
   - `RESEND_FROM_EMAIL=no-reply@yourdomain.com`

## Rollback

1. Roll app version back in your host.
2. If schema rollback is required and safe:
   - `cd server`
   - `npm run migrate:down -- --steps 1`
3. Re-check `GET /api/health`.
