# Security

> Purpose: the single accurate description of the security controls in this template: headers and CSP, CORS, CSRF, rate limiting, auth cookies and tokens, input validation, SQL, tenant scoping, secrets, and what to check before release. Replaces the former `server/SECURITY*.md`, `server/SECURITY_MIDDLEWARE.md` and `server/CSRF_INTEGRATION_EXAMPLE.md`.
> Last verified: 2026-09-20 (`server/src/app.js`, `lib/@system/Middleware/{security,cors,csrf}.js`, `lib/@system/RateLimit`, `lib/@system/Validation`, `lib/@system/Helpers/{auth,cookies,jwt,password-validator}.js`, `lib/@custom/tenantContext.js`).

Report vulnerabilities to security@assimetria.com (see root `SECURITY.md`). Do not open public issues for security bugs.

## 1. Controls at a glance

| Control | Where | Applied |
|---|---|---|
| Security headers + CSP | `lib/@system/Middleware/security.js` (helmet 7) | first middleware in `app.js`, every response |
| CORS allow-list | `lib/@system/Middleware/cors.js` | after health checks |
| CSRF double submit | `lib/@system/Middleware/csrf.js` (csrf-csrf 4) | global, after `cookieParser` |
| Rate limiting | `lib/@system/RateLimit` (express-rate-limit 7, Redis store) | `/api` baseline + per-route limiters |
| Input validation | `lib/@system/Validation` (zod 4) | per route, `validate({ body, query, params })` |
| Authentication | `lib/@system/Helpers/auth.js` | per route, `authenticate` / `requireAuth` |
| Authorization | `requireAdmin`, `lib/@system/permissions.js`, `lib/@custom/tenantContext.js` | per route |
| Password policy | `lib/@system/Helpers/password-validator.js` | register / reset |
| Account lockout | `lib/@system/AccountLockout` | login |
| Audit log | `lib/@system/AuditLog` (table `audit_logs`) | sensitive actions |
| Error handling | `app.js` global handler, `lib/@system/Errors`, Sentry | last |
| Secrets at rest | `ENCRYPT_KEY` / `ENCRYPT_IV` (AES-256-CBC) via Helpers | API keys, OAuth tokens |

## 2. Headers and Content-Security-Policy

`securityHeaders` composes helmet and a custom `Permissions-Policy`:

- `Content-Security-Policy`: `default-src 'self'`; `script-src` and `connect-src` from `brand.json` `securityHeaders.contentSecurityPolicy.{scriptSrc,connectSrc}` (defaults `'self' https://js.stripe.com` and `'self' https://api.stripe.com https://*.plausible.io`), plus the sha256 hash of the inline cookie-consent script computed from `client/dist/index.html` at boot; `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`; `img-src 'self' data: https:`; `font-src 'self' https: data:`; `frame-src https://js.stripe.com`; `object-src 'none'`; `upgrade-insecure-requests` in production.
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` (production only).
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-site`, `X-DNS-Prefetch-Control: off`, `X-Download-Options: noopen`, `X-Permitted-Cross-Domain-Policies: none`, `X-XSS-Protection: 0`, no `X-Powered-By`.
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()`.

Adding a third-party script or API: add its origin to `brand.json` `securityHeaders.contentSecurityPolicy.scriptSrc` / `connectSrc` and restart. Never add `'unsafe-inline'` to `script-src`; HTML minification keeps `minifyJS: false` so the inline hash stays stable.

Current state: `security.js` still reads the snake_case keys (`security_headers.content_security_policy.script_src`), so the camelCase arrays in `brand.json` are ignored until the server agent's change lands; helmet defaults apply meanwhile.

## 3. CORS

Allow-list built once at boot: `APP_URL`, each entry of `CORS_ORIGINS` (comma-separated), plus `http://localhost:5173` and `http://localhost:3000`. Exact string match (no wildcard subdomains). Requests without an `Origin` header pass (same-origin, curl, server-to-server). Rejected origins get `403 { message: "CORS: origin '...' not allowed" }` directly. `credentials: true`; allowed headers `Content-Type, Authorization, X-Requested-With, Accept, X-CSRF-Token`; exposed `X-Total-Count, X-Request-Id`; preflight cached 10 min.

Target: localhost origins only outside production. Set `APP_URL` to the public origin in App Runner; add preview or custom domains through `CORS_ORIGINS`.

## 4. CSRF

Double-submit cookie pattern (`csrf-csrf`): the server sets an httpOnly, `SameSite=Strict`, `Secure` (production) cookie named `__Host-psifi.x-csrf-token` (production) / `psifi.x-csrf-token` (dev). Clients call `GET /api/csrf-token` and send the returned token in `X-CSRF-Token` on POST/PUT/PATCH/DELETE. `GET/HEAD/OPTIONS` are ignored.

Exempt paths: `/api/auth/refresh`, `/api/sessions/refresh`, `/api/webhook`, `/api/stripe/webhook`, `/api/payments/webhook`, `/api/gdpr/consent`, `/api/v1/*`; and any request authenticated by API key (`X-API-Key` or bearer key). Login and register additionally use `requireCsrfPresence` to block login-CSRF.

Client side: `client/src/app/lib/@system/api.js` fetches the token lazily before the first mutation, attaches the header, and refetches once on `403 CSRF_VALIDATION_FAILED`. Use it (or `authFetch` from the auth store) for every mutation; do not call `fetch` directly for POSTs.

`CSRF_SECRET` (32+ chars) must be set in production; `start.sh` and `csrf.js` generate an ephemeral one if missing, which invalidates tokens on every restart. `SKIP_CSRF=true` disables checks and must never be set in production.

## 5. Rate limiting

`createLimiter({ windowMs, max, prefix, message?, keyGenerator? })` returns express-rate-limit middleware using a Redis `INCR`/`EXPIRE` store when Redis is ready, memory otherwise, with `RateLimit-*` and `X-RateLimit-*` headers and a JSON 429. Limiting is **skipped** when `NODE_ENV` is `development` or `test`, or when `X-Test-Key` equals `TEST_API_KEY`.

Built-in limiters (window / max): `apiLimiter` (baseline on `/api`), `loginLimiter` 1 min / 5, `registerLimiter` 1 h / 3, `passwordResetLimiter` 1 h / 5, `emailVerifyRequestLimiter` 1 h / 5, `emailVerifyLimiter` 1 min / 20, `refreshLimiter` 1 min / 30, `apiKeyLimiter` 1 h / 10, plus `uploadLimiter`, `aiChatLimiter`, `aiImageLimiter`, `totpSetupLimiter`, `totpEnableLimiter`, `adminReadLimiter`, `adminWriteLimiter`, `emailTestLimiter`, `oauthLimiter`, `retentionLimiter`, `integrationTestLimiter`. Add one for any new endpoint that sends email, spends money, or is unauthenticated.

## 6. Authentication and sessions

- Passwords: bcrypt (`bcryptjs`), policy = 12+ chars, one uppercase, one digit, one special (`password-validator.js`). Lockout after 5 failures for 15 min (Redis or in-memory fallback).
- Access token: RS256 JWT (`JWT_PRIVATE_KEY_FILE` or inline `JWT_PRIVATE_KEY`, public key `JWT_PUBLIC_KEY[_FILE]`), 15 min, in the `access_token` cookie (`httpOnly`, `SameSite=Lax`, `Secure` in production, `path=/`). Also accepted as `Authorization: Bearer`.
- Refresh token: `refresh_token` cookie scoped to `path=/api/sessions`, 7 days (30 with remember-me), rotated on `POST /api/sessions/refresh`, family-based reuse detection revokes the whole family.
- Logout blacklists via Redis when available (`REDIS_URL`); without Redis, logout cannot invalidate an access token before it expires.
- OAuth (Google, GitHub) validates `state` and redirects only to allow-listed paths (`server/test/unit/@system/oauth-open-redirect.test.js`). TOTP with recovery codes (`api/@system/totp`).
- API keys: `sk_` prefixed, stored as SHA-256 hashes, scoped, per-key rate limit, encrypted secrets at rest.
- `/api/health` probes JWT sign/verify and reports `auth: misconfigured` when keys are missing.

Never generate keys inside the image for production: `start.sh` auto-generates ephemeral RSA keys and `CSRF_SECRET` only as a last resort; every restart then logs out every user. Set them as App Runner secrets.

## 7. Input validation and SQL

- Every mutating route runs `validate({ body, query, params })` with zod schemas; the middleware replaces `req.body|query|params` with the parsed (coerced) values and returns `400 { message: 'Validation failed', errors: [{ field, message }] }`.
- SQL is pg-promise with positional `$1` placeholders only. Dynamic identifiers (column lists, sort fields) are whitelisted (`UserRepo.update`, `sorting({ allowedFields })`, `filtering({ allowedFields })`). `server/test/unit/@system/userrepo-sql-injection.test.js` guards the pattern.
- `express.json` limit is 10 MB; uploads go through `StorageAdapter` with path traversal tests (`storage-path-traversal.test.js`) and `MAX_FILE_SIZE_MB`.
- HTML from users is sanitised with `sanitize-html` before storage or rendering.

## 8. Tenant scoping

`lib/@custom/tenantContext.js` runs after `requireAuth`: reads `X-Tenant-Id` (fallback `?tenant=`), verifies membership in `tenant_members`, sets `req.tenant` and `req.tenantRole`, falls back to the user's first tenant when no header is given. `requireTenantRole('owner', 'admin')` guards role-restricted actions. Every query on a tenant-owned table must include `tenant_id = $n`.

Target pattern (Postgres row-level security): a `withTenant(tenantId, fn)` helper that runs `fn` inside `db.tx` after `SET LOCAL app.current_tenant_id = $1`, with RLS policies on tenant tables comparing `tenant_id` to `current_setting('app.current_tenant_id')::int`. Check `server/src/lib/@custom/` for `withTenant` before writing your own; if absent, follow this description.

## 9. Error handling and logging

- Global handler returns `{ message }` (target `{ message, code?, requestId }`), redacts filesystem paths, maps parser errors to 400, DB connection failures to 503, Stripe errors to user-safe messages, and never leaks stack traces. In production the 5xx message is generic.
- Logs: pino JSON in production (`pino-http`), request method/url and error name/stack; no request bodies. Sentry via `SENTRY_DSN` / `ERROR_TRACKING_DSN` (`lib/@system/ErrorTracking`).
- Audit: `AuditLog.log({ userId, action, resource, metadata })` for account, billing and admin actions; retention via `AUDIT_LOG_RETENTION_DAYS` and `api/@system/retention`.

## 10. Secrets and configuration

- Never commit `.env`, `server/.keys/`, or real keys. `.env.example` files hold placeholders only.
- Required in production (`lib/@custom/Env`): `DATABASE_URL`, `APP_URL`. Strongly recommended: `CSRF_SECRET`, `JWT_PRIVATE_KEY[_FILE]`, `JWT_PUBLIC_KEY`, `ENCRYPT_KEY`, `ENCRYPT_IV`, `REDIS_URL`, `SENTRY_DSN`. Provider keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, email, storage) as needed. Full list: `docs/DEPLOYMENT.md`.
- Rotate `JWT_*` keys by deploying new values (all sessions end); rotating `ENCRYPT_KEY`/`ENCRYPT_IV` invalidates encrypted data, so re-encrypt first.
- GitHub Actions secrets for deploy: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `ECR_REPO_NAME`, `APP_RUNNER_SERVICE_ARN` (least-privilege IAM: ECR push + `apprunner:StartDeployment`).

## 11. Webhooks

Stripe: `express.json` keeps `req.rawBody` for URLs ending in `/webhook`; `stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET)` verifies the signature; events are idempotent by Stripe event id. Polar uses `POLAR_WEBHOOK_SECRET`. Webhook routes are CSRF-exempt and must remain unauthenticated but signature-verified.

## 12. Privacy (GDPR)

`POST /api/gdpr/consent` records cookie consent (anonymous, CSRF-exempt), `GET /api/gdpr/my-data` exports the user's data, `DELETE /api/gdpr/my-data` erases it. The cookie banner is `components/@system/CookieConsentBanner`; legal pages are `/terms`, `/privacy`, `/cookies`, `/dpa`, `/refund-policy` (content in `pages/static/@system/*`; DPA template in `docs/legal/dpa-template.md`).

## 13. Release checklist

The checkbox version is `docs/SECURITY_CHECKLIST.md`. Minimum before a production deploy:

1. `APP_URL`, `CORS_ORIGINS` set to real origins; no localhost in production.
2. `CSRF_SECRET`, `JWT_*`, `ENCRYPT_*` set as App Runner secrets (not auto-generated).
3. `NODE_ENV=production`; `SKIP_CSRF` unset; `GRAPHQL_INTROSPECTION` unset.
4. Every new mutating route has zod validation and, if abusable, a limiter.
5. Every new tenant-owned table has `tenant_id` and is scoped in every query.
6. `npm audit --omit=dev` in `server/` and `client/` shows no high/critical without an accepted exception.
7. `GET /api/health` on the deployed URL reports `auth: ok`, `db: connected`.
