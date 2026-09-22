# API

> Purpose: how the REST API authenticates, what errors look like, the pagination/sort/filter helpers, where the OpenAPI spec is, and the exact steps to add a validated route.
> Last verified: 2026-09-20 (`server/src/app.js`, `lib/@system/Helpers/auth.js`, `lib/@system/Validation`, `lib/@system/Middleware/*`, `api/@system/docs`).

## 1. Base URL and discovery

- All routes are mounted under `/api` (`server/src/app.js`). Route files declare paths relative to that prefix.
- OpenAPI 3.0.3 spec: `GET /api/docs.json`. Swagger UI: `GET /api/docs`. Title and version come from `PRODUCT_NAME` and `API_VERSION` env vars.
- Health: `GET /api/health` (also `/health`) returns `{ status: 'ok'|'degraded', db, db_source, auth, version, uptime, timestamp, checks }` with HTTP 200 always; `GET /healthz` returns `{ status: 'ok' }`.
- GraphQL (optional) is attached by `server/src/graphql/@system` when it loads.

## 2. Authentication

`authenticate` (`server/src/lib/@system/Helpers/auth.js`; `requireAuth` in `server/src/middleware/@system/auth.js` is an alias) accepts, in this order:

| Method | How | Notes |
|---|---|---|
| Browser session (default) | `access_token` httpOnly cookie, set by `POST /api/auth/login` or `POST /api/sessions` | RS256 JWT, 15 min. Refresh with `POST /api/sessions/refresh` using the `refresh_token` cookie (path `/api/sessions`, 7 days or 30 with remember-me, rotated on use, family reuse detection) |
| Bearer JWT | `Authorization: Bearer <jwt>` | Same token as the cookie, for non-browser clients |
| Session token | `Authorization: Bearer <96-hex>` | Opaque token validated against `sessions`, 30-day family lifetime |
| API key | `X-API-Key: sk_...` or `Authorization: Bearer sk_...` | SHA-256 hashed lookup in `api_keys`; scopes and per-key rate limit; CSRF exempt |
| RapidAPI | `X-RapidAPI-Proxy-Secret` | Marketplace proxy only |

Failed attempts are counted per key hash / user id: 10 failures per hour returns 429. Login also has account lockout (5 failures, 15 min) in `lib/@system/AccountLockout`.

Roles: `req.user.role` is `user` or `admin`; `requireAdmin` guards admin routes. Team roles (`viewer < member < admin < owner`) are checked with `lib/@system/permissions.js`. Tenant scope is added per request by `lib/@custom/tenantContext.js` (`X-Tenant-Id` header, membership check, `req.tenant`, `req.tenantRole`, `requireTenantRole('owner','admin')`).

CSRF: browser clients fetch `GET /api/csrf-token` once and send `X-CSRF-Token` on every POST/PUT/PATCH/DELETE (the client helper `lib/@system/api.js` does this automatically). Exempt: refresh endpoints, webhooks, `/api/gdpr/consent`, `/api/v1/*`, API-key requests. Login and register additionally require the token to be present (`requireCsrfPresence`).

## 3. Response conventions

Success: `{ data }` for a resource or list, `{ data, total, limit, offset, page, total_pages, has_more }` for paginated lists (`formatPaginatedResponse`). Some helpers in `Helpers/response.js` return `{ success: true, data, message }`; prefer the plain `{ data }` shape for new code. `201` on create, `204` with no body on delete.

Errors (global handler in `server/src/app.js`):

```json
{ "message": "Human readable", "code": "OPTIONAL_MACHINE_CODE", "requestId": "..." }
```

- Validation failures: `400 { message: 'Validation failed', errors: [{ field: 'body.name', message: '...' }] }`.
- Invalid JSON body: `400 { message: 'Invalid JSON in request body' }`.
- Auth: `401 { message }`; forbidden / CSRF: `403 { message, error: 'CSRF_VALIDATION_FAILED' }` for CSRF.
- Not found: `404 { message: 'Not found' }` (also for unmatched `/api/*`).
- Rate limited: `429 { message }` with `RateLimit-*` and `X-RateLimit-*` headers.
- DB unavailable: `503 { message }`.
- 5xx in production: generic `message`, never a stack or path; details go to the logs and Sentry.

Current state: the handler returns `{ message }` only; `code` and `requestId` are the target being added by the server agent. A few `@custom` scaffolds return `{ error }` (for example `api/@custom/tenants.js`); new code should use `message`.

Throw typed errors instead of hand-rolling statuses: `const { AppError, NotFoundError, ValidationError } = require('../../lib/@system/Errors')`; `throw new NotFoundError('Project not found')` inside an `asyncHandler` reaches the global handler with the right status.

## 4. Pagination, sorting, filtering, search

All from `server/src/lib/@system/Middleware` (re-exported by `lib/@system/Helpers`).

| Middleware | Query params | Attaches |
|---|---|---|
| `pagination({ defaultLimit = 20, maxLimit = 100, allowAll = false })` | `limit`, `offset`, `page` (page wins over offset; `limit=-1` for all when `allowAll`) | `req.pagination = { limit, offset, page }` |
| `sorting({ allowedFields, defaultField = 'created_at', defaultOrder = 'desc' })` | `sort`, `order` (`asc`/`desc`) | `req.sorting`; `formatSortClause(req.sorting)` gives `ORDER BY ...` |
| `filtering({ allowedFields })` | `?status=active&user_id=3` (whitelisted fields only) | `req.filters` |
| `advancedFiltering({ allowedFields, allowedOperators })` | `?price[gte]=100&name[ilike]=lap` with `eq ne gt gte lt lte in nin like ilike` | `req.filters` |
| `parseSearchQuery(req, { searchFields })` + `buildWhereClause(...)` (Helpers/search.js) | `q` | SQL fragment + `$n` params |

`parseQueryParams(req, { searchFields, sortableFields, filterFields, booleanFields, arrayFields })` (Helpers) combines them; `handleList({ repo, req, res, ... })` and `createCrudRouter({ repo, config })` build whole endpoints. Reference: `server/src/lib/@system/Helpers/README.md` and `server/src/lib/@system/Middleware/MIDDLEWARE_GUIDE.md`.

## 5. Add a validated route (checklist)

1. Migration if the route needs new tables/columns: `cd server && npm run migrate:create -- <name>`; write `up`/`down` with `db.none` and `IF NOT EXISTS`; `npm run migrate`.
2. Repo in `server/src/db/repos/@custom/<Name>Repo.js` using `db.any/one/oneOrNone/none/result` with `$1` placeholders; export from `@custom/index.js`.
3. Zod schemas next to the route (or in a `schemas.js`): `z.object({...})`; use `z.coerce.number()` for ids in params/query.
4. Route file `server/src/api/@custom/<name>.js`: `express.Router()`, paths relative to `/api`, `requireAuth` (and `requireAdmin` / `tenantContext` as needed), `validate({ body|query|params })`, `asyncHandler`, `{ data }` responses, typed errors.
5. Register in `server/src/routes/@custom/index.js` inside the try/catch pattern.
6. Rate limit anything abusable: `createLimiter({ windowMs, max, prefix: 'rl:<name>:' })` from `lib/@system/RateLimit` and add it before the handler.
7. Tests: `server/test/api/@custom/<name>.test.js` with supertest against `require('../../../src/app')` (mock the repo or use `DATABASE_URL`).
8. Document it: add the path to the OpenAPI builder only if it is a template feature (`api/@system/docs`); product routes are discoverable from `routes/@custom/index.js`.

Full code example: `docs/CUSTOM-OVERRIDES.md` section 1.

## 6. Endpoint map (template)

| Area | Paths (under `/api`) |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /sessions`, `POST /sessions/refresh`, `GET /sessions/me`, `GET /sessions`, OAuth under `/oauth/*`, TOTP under `/totp/*` |
| Account | `/user/*`, `/sessions/*`, `/api-keys`, `/gdpr/consent`, `/gdpr/my-data` (GET/DELETE), `/communications/*`, `/notifications/*` |
| Teams | `/teams/*` (`api/@system/teams/router.js`) |
| Billing | `/subscriptions/*`, `/payments/*`, `/stripe/webhook`, `/polar/*` |
| Content | `/blog/*`, `/search/*`, `/storage/*`, `/ghost/*` |
| Ops | `/health` (liveness, always 200), `/ready` (readiness, 503 while the DB is unreachable), `/ping`, `/docs`, `/docs.json`, `/csrf-token`, `/admin/*`, `/usage/*`, `/activity/*`, `/webhooks/*`, `/integrations/*`, `/retention/*` |
| Product scaffold (`api/@custom`) | `GET /dashboard`, `GET /billing`, `GET /settings`, `GET /admin`, tenants (`api/@custom/tenants.js`) |

The authoritative list is `server/src/routes/@system/index.js` plus `server/src/routes/@custom/index.js`; `GET /api/docs.json` is authoritative for request/response schemas of template endpoints.
