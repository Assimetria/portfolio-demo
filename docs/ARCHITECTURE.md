# Architecture

> Purpose: how a request flows through the server, how the client boots, and how `@custom` overrides `@system` at every seam. Paths and order are taken from the code, not from memory.
> Last verified: 2026-09-20 (`server/src/app.js`, `server/src/index.js`, `client/src/main.jsx`, `client/src/App.jsx`).

## 1. Shape of the system

```
Browser
  |  HTTPS
  v
AWS App Runner  ->  Docker container (root Dockerfile), one Node process, port 3000
                      Express (server/src/app.js)
                        /api/*        -> API routers (@custom first, then @system)
                        /health, /api/health, /healthz
                        /robots.txt, /sitemap.xml (dynamic)
                        static files  -> server/src/public, then client/dist (SPA_HTML_DIR)
                        everything else -> spaFallback serves client/dist/index.html with per-route SEO meta
                      PostgreSQL (pg-promise pool)    Redis (optional: rate-limit store, cache, queues)
                      Stripe / Polar, Resend / SMTP / SES, S3 / R2, Sentry
```

In development there are two processes: the API on `:3001` (`cd server && npm run dev`, nodemon) and the Webpack dev server on `:3000` that proxies `/api` to `:3001` (`client/webpack.config.mjs` `devServer.proxy`).

## 2. Server boot (`server/src/index.js`)

1. `dotenv` loads `server/.env`.
2. Migrations run synchronously via `node src/db/migrations/@system/run.js`; on failure the runner retries once after `server/scripts/drop-schema-migrations.js`; failure is non-fatal (server starts degraded).
3. `require('./lib/@system/Env')` validates template env vars; `require('./lib/@custom/Env')` validates product vars and exits on missing `REQUIRED_VARS` in production (`DATABASE_URL`, `APP_URL`).
4. `ErrorTracking.init()` (Sentry).
5. Postgres pool and Redis connect; both non-fatal.
6. Optional email-log callback (`db/repos/@custom/EmailLogRepo` if present).
7. Scheduler: `scheduler/tasks/@custom/init.js` is called with the singleton `scheduler` so products can `registerTask(new MyTask())`.
8. `http.createServer(app)`; GraphQL (`graphql/@system`) attaches if it loads.
9. Listen on `PORT` (default 3001) bound to `0.0.0.0` in production, `127.0.0.1` otherwise. SIGTERM/SIGINT drain and close the pool; unhandled rejections are fatal.

## 3. Request lifecycle (`server/src/app.js`, in order)

| # | Middleware | Notes |
|---|---|---|
| 1 | `app.set('trust proxy', 1)`, `app.disable('x-powered-by')` | Real client IP and protocol behind App Runner |
| 2 | `securityHeaders` (helmet) | CSP, HSTS (production only), frameguard deny, nosniff, referrer policy, Permissions-Policy. `script-src`/`connect-src` come from `brand.json` |
| 3 | `GET /health`, `GET /api/health`, `GET /healthz` | Registered before CORS so load-balancer probes without `Origin` pass. `/health` runs `SELECT 1` and a JWT sign/verify probe; always HTTP 200 with `status: ok|degraded` |
| 4 | `cors` | Allow-list: `APP_URL`, `CORS_ORIGINS` (comma-separated), plus `http://localhost:5173` and `http://localhost:3000`; exact match; rejected origins get 403 JSON |
| 5 | `compression()` | |
| 6 | `express.json({ limit: '10mb', verify })` | Raw body kept on `req.rawBody` for URLs ending in `/webhook` (Stripe signature check) |
| 7 | `cookieParser()` | |
| 8 | `csrf` (csrf-csrf double submit) | Validates `X-CSRF-Token` against the httpOnly cookie on POST/PUT/PATCH/DELETE. Exempt paths: `/api/auth/refresh`, `/api/sessions/refresh`, `/api/webhook`, `/api/stripe/webhook`, `/api/payments/webhook`, `/api/gdpr/consent`, `/api/v1/*`, and any request authenticated by API key |
| 9 | HTTP logging | `pino-http` in production, `morgan('dev')` otherwise, nothing in `test` |
| 10 | Dynamic `sitemap.xml` and `robots.txt` routers | Use the request host |
| 11 | `express.static(server/src/public)` | Favicons, cookie-consent.js |
| 12 | `express.static(SPA_HTML_DIR)` | Production only; `index: false` so the SPA fallback owns `index.html` |
| 13 | `/api` `Cache-Control: private, no-cache` | |
| 14 | `/api` `apiLimiter` | express-rate-limit; Redis store when Redis is ready, memory otherwise; skipped in `development`/`test` or with `X-Test-Key: $TEST_API_KEY` |
| 15 | `/api` `attachDatabase` | Attaches `req.db` with the `@system` repos |
| 16 | `/api` `mergeRoutes(systemRoutes, customRoutes)` | `@custom` router first, `@system` second: first matching handler wins, so a `@custom` route with the same method + path overrides `@system`. Route files declare paths relative to `/api` |
| 17 | `spaFallback` | Serves `client/dist/index.html` with route-specific `<title>`/`og:*` injected; skips `/api`, `/health` and file-like paths |
| 18 | 404 | `{ message: 'Not found' }` as JSON |
| 19 | `ErrorTracking.errorHandler()` | Sentry capture |
| 20 | Global error handler | Logs with pino; maps JSON parse errors to 400, DB connection timeouts to 503, Stripe errors to safe messages; otherwise `res.status(err.status ?? 500).json({ message })` with filesystem paths redacted. Target shape is `{ message, code?, requestId }` with a generic message for 5xx in production (see `docs/API.md`) |

Per-route middleware you compose inside route files: `requireAuth`/`authenticate`, `requireAdmin`, `validate({ body, query, params })` (zod), `pagination()`, `sorting()`, `filtering()`, per-route limiters from `lib/@system/RateLimit`, and `tenantContext` / `requireTenantRole` from `lib/@custom/tenantContext.js`.

Auth resolution (`lib/@system/Helpers/auth.js`) accepts, in order: `X-RapidAPI-Proxy-Secret`, `X-API-Key`, `Authorization: Bearer <96-hex session token>`, `Bearer <RS256 JWT>`, other bearer API keys, and the `access_token` httpOnly cookie set by `/api/auth/login` and `/api/sessions`. Refresh tokens live in the `refresh_token` cookie scoped to `path=/api/sessions`.

## 4. Client bootstrap

```
client/index.html  (HtmlWebpackPlugin template; BRAND_NAME / BRAND_TAGLINE / BRAND_DESCRIPTION / BRAND_COLOR injected from brand.json)
  -> client/src/main.jsx
       validateEnv()                       lib/@system/env.js
       initSentry()                        lib/@system/sentry.js
       applyBrandColors(info)              lib/@system/brandPrePaint.js: writes --primary/--ring/--brand-panel-* before first paint
       applyDefaultTheme(info)             seeds localStorage 'app-theme' from info.defaultTheme (brand.json defaultTheme)
       import './index.css'                @tailwind + @system/general.css + @custom/brand.css + @custom/general.css
       <React.StrictMode><App /></React.StrictMode>
  -> client/src/App.jsx
       <ErrorBoundary><BrowserRouter><Analytics /><AppRoutes /></BrowserRouter></ErrorBoundary>
  -> client/src/app/routes/@system/AppRoutes.jsx
       routes = mergeRoutes(systemRoutes, customRoutes)      // keyed by path; @custom replaces
       <Suspense><Routes>{routes.map(r => <Route path element />)}</Routes></Suspense>
```

Providers: `AuthProvider` (`store/@system/auth.jsx`) and `ThemeProvider` (`store/@custom/ThemeContext.jsx`, re-exported by `store/@system/theme.jsx`) must wrap `AppRoutes`; `GuestRoute`, `ProtectedRoute`, the sidebar and the settings pages call `useAuthContext()` / `useTheme()` and throw without them. Route elements are created once in the route tables (never conditionally at render time; Terser strips render-time wrapping). `/app/*` pages render their own dashboard chrome via `components/@system/Dashboard` / `AppLayout`; the sidebar reads the navigation registry (`config/@custom/navigation.js` merged over `config/@system/navigation-defaults.js`).

Data fetching goes through `lib/@system/api.js`: `credentials: 'include'`, lazy `GET /api/csrf-token` before the first mutation, `X-CSRF-Token` header, one retry after `POST /api/sessions/refresh` on 401, redirect to `/auth` if the session is unrecoverable on an `/app` route.

## 5. Override chain

```
                    @system (template, synced)             @custom (product, never synced)
server routes       routes/@system/index.js (barrel)   <-  routes/@custom/index.js          mergeRoutes: @custom mounted first
server API files    api/@system/**                          api/@custom/*.js
repos               db/repos/@system/*Repo.js               db/repos/@custom/*Repo.js
migrations          db/migrations/@system/NNN_*.js  then    db/migrations/@custom/NNN_*.js  (schema_migrations)
scheduler           scheduler/tasks/@system/*               scheduler/tasks/@custom/init.js registers tasks
workers             workers/@system/index.js                workers/@custom/index.js
env validation      lib/@system/Env                    then lib/@custom/Env
client routes       routes/@system/AppRoutes.jsx       <-  routes/@custom/index.jsx         mergeRoutes by path
pages               pages/{app,static}/@system/*Page        pages/{app,static}/@custom/*Page
components          components/@system/** (+ ui/)      <-  components/@custom/**            barrel: export * @system then @custom
identity            config/@system/info.js             <-  config/@custom/info.js (generated from brand.json)   { ...system, ...custom }
text                config/@system/text                <-  config/@custom/text              deepMerge
content             content/@system/<key>.js           <-  content/@custom/<key>.js         loadContent(key) merge
navigation          config/@system/navigation-defaults <-  config/@custom/navigation.js     mergePages by path
styles              styles/@system/general.css          +  styles/@custom/brand.css (generated) + styles/@custom/general.css
e2e                 e2e/@system/*.spec.js                   e2e/@custom/*.spec.js
```

Sync: `scripts/@system/sync-upstream.sh` pushes `@system` from the template to product repos with a three-way merge and preserves `// @sync-guard:name ... // @end-sync-guard` regions; `scripts/@system/check-system-sync.sh` fails CI if a product's `@system` drifted. `.template-sync-protect.json` lists dependencies sync must not re-add or downgrade.

## 6. Data layer

- Connection: `server/src/lib/@system/PostgreSQL/index.js` (pg-promise, pool `DB_POOL_MAX` default 10, SSL rules by environment). `server/src/db/index.js` re-exports it as `{ db }`.
- Repos are plain objects of async functions using `db.any / db.one / db.oneOrNone / db.none / db.result / db.tx` with `$1` placeholders. Dynamic column lists are whitelisted (see `UserRepo.update`).
- Migrations: see `docs/MIGRATIONS.md`. Schema reference SQL lives in `server/src/db/schemas/@system/*.sql` (documentation, not executed by the runner).
- Multi-tenant scaffold: `tenants` and `tenant_members` (`db/migrations/@custom/001_multi_tenant.js`), `TenantRepo`, `tenantContext` middleware.

## 7. Build and deploy shape

`node scripts/prebuild.js` -> `scripts/apply-brand.js` regenerates `brand.css` and `config/@custom/info.js` -> `cd client && npm run build` (Webpack production: content-hashed JS/CSS, gzip + brotli, `assets/{logos,favicons,og}` copied into `client/dist`) -> `client/scripts/verify-build.mjs` -> Dockerfile stage 3 copies `client/dist`, `server/src`, `brand.json`, `VERSION`, assets -> `start.sh` sets `PORT=3000`, `SPA_HTML_DIR=/app/client/dist`, auto-generates ephemeral `CSRF_SECRET` and JWT keys if absent (set real ones in App Runner) -> `node server/src/index.js`. Details: `docs/DEPLOYMENT.md`.

## 8. Technology decisions (short)

- Webpack 5 rather than Vite: the SEO/CSP pipeline (stable inline-script hashes, `__APP_URL__` placeholders, per-route meta injection) and the `@system/@custom` HMR watch rules are built around it.
- pg-promise rather than an ORM: SQL stays visible, placeholders are positional, repos are trivially testable.
- One process serving API and SPA: App Runner health checks one port, no nginx to keep in sync with CSP.
- shadcn/ui primitives copied into the repo: themable through the generated HSL tokens, no runtime dependency.
