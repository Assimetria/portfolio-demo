# Informational Website Template

**Assimetria's template for simple informational websites** — VC firms, consultancies, law firms, restaurants, trades, studios, portfolios.

> Third Orkosi template type, alongside the SaaS template (`Assimetria/product-template`) and the Shopify-like template (`Assimetria/product-template-shopify`). Same React 18 + Webpack 5 + Express + PostgreSQL foundation; the front door is a content-driven single-page website instead of a SaaS landing page.

## What you get at `/`

Hero → About → Services → Team → Testimonials → Contact (form + map) → Footer, all rendered from **one content file**:

- `client/src/app/content/@system/site.js` — template defaults (fictional "Northwind Advisory")
- `client/src/app/content/@custom/site.js` — your overrides (`export default { hero: { title: '…' } }`), deep-merged
- `site.features` flags: `showAuth`, `showBlog`, `showPricing`, `showTeam`, `showTestimonials`, `showMap`, `showContactForm`

The contact form POSTs to `/api/contact` (rate limited, honeypot, zod validation), stores in `contact_submissions`, emails `CONTACT_NOTIFY_EMAIL || EMAIL_FROM`, and shows up in the admin inbox at `/app/contact` (log in at `/auth` as an admin). The map is an OpenStreetMap iframe from `lat/lng/zoom` — no API key; switch to Google with `map.embedUrl` or to an address card with `provider: 'none'`.

Sites converted from an existing URL by Orkosi's cloner drop into `client/src/app/pages/@custom/imported/` and register routes in `routes/@custom/index.jsx` — see `docs/INFORMATIONAL-SPEC.md` §6.

Full specification: **[docs/INFORMATIONAL-SPEC.md](docs/INFORMATIONAL-SPEC.md)**. Agent guidance: `CLAUDE.md`.

### Quick start

```bash
npm run first-setup            # deps, keys, env, local Postgres
npm run dev                    # client :5173 + API :3000
# edit client/src/app/content/@custom/site.js — the site updates live
node scripts/prebuild.js && cd client && npm run build   # production bundle (brand.json → tokens)
```

The SaaS landing page is still available at `/saas-landing` for reference; pricing/blog/Stripe are optional and off by default.

---

# Brand Assets — Single Source of Truth
All brand assets (favicon, icons, apple-touch-icon, og-image) are generated from `brand.json` + `assets/logos/` by `scripts/apply-brand.js` and `scripts/generate-brand-assets.js` (both run in `node scripts/prebuild.js`).
After changing `brand.json` or the logo, run `node scripts/prebuild.js` to regenerate `brand.css`, `@custom/info.js` and all icon sizes.
---

## Purpose

The Product Template is the starting point for all Assimetria products. It solves the "blank slate problem" by providing:

1. **Consistent architecture** — All products share the same structure, making agent handoffs seamless
2. **Battle-tested patterns** — Auth, database, payments, and deployment are solved once, reused everywhere
3. **Fast iteration** — Bootstrap a new product in minutes, not days
4. **Maintainability** — Template updates (`@system`) propagate to all products via sync workflow

**Not a framework.** This is a scaffold — fork it, customize it, ship it.

---

## 5-minute quickstart

Prerequisites: Node 22 (CI uses 22; the Dockerfile currently pins `node:20-alpine`), npm 10, Docker (for the local Postgres container), Git.

```bash
git clone git@github.com:Assimetria/product-template.git my-product
cd my-product

# 1. Root tooling, .env files, RS256 + AES keys, @custom scaffolding, local Postgres container
npm run first-setup          # = npm i && npm run bootstrap && npm run set-customs && npm run db-local

# 2. Workspace deps (the root package.json does NOT install these)
(cd server && npm install)
(cd client && npm install)

# 3. Database schema (@system migrations, then @custom)
(cd server && npm run migrate)

# 4. API on http://localhost:3001 + client dev server on http://localhost:3000 (proxies /api)
npm run dev
```

What `bootstrap` did: copied `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env`, wrote an RSA key pair to `server/.keys/jwt_private.pem` (gitignored) and filled `JWT_PRIVATE_KEY_FILE`, `JWT_PUBLIC_KEY`, `ENCRYPT_KEY`, `ENCRYPT_IV`. Set `CSRF_SECRET` yourself (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) and set `APP_URL=http://localhost:3000`. Everything else in `server/.env.example` is optional and documented inline.

Check it works: `curl http://localhost:3001/api/health` returns `{"status":"ok","db":"connected","auth":"ok",...}`.

Prefer containers for infra? `docker compose -f docker-compose.local.yml up -d` starts Postgres 15 + Redis 7 only; run client and server natively as above.

---

## Stack

| Layer | What | Where |
|---|---|---|
| Client | React 18, React Router 6, Webpack 5 (not Vite), Tailwind 3, shadcn/ui primitives, lucide-react, framer-motion, recharts | `client/`, `client/webpack.config.mjs` |
| Server | Node 22, Express 4, pg-promise (`$1` placeholders), zod, helmet, csrf-csrf, express-rate-limit (+Redis store), pino | `server/src/` |
| Auth | RS256 JWT access token (15 min) + rotating refresh token (7/30 days), both httpOnly cookies; OAuth Google/GitHub; TOTP; API keys | `server/src/api/@system/{auth,sessions,oauth,totp,api-keys}` |
| Data | PostgreSQL 15+, custom migration runner (`schema_migrations`), repos over `db.any/one/oneOrNone/none` | `server/src/db/` |
| Billing | Stripe and Polar adapters, webhooks with raw-body signature verification | `server/src/lib/@system/{Stripe,Polar,PaymentAdapter}` |
| Email | Resend / SMTP / SES / console adapters, BullMQ email queue | `server/src/lib/@system/{Email,EmailQueue}` |
| Storage | S3 / R2 / local | `server/src/lib/@system/StorageAdapter` |
| Jobs | node-cron scheduler (`BaseTask`), BullMQ workers | `server/src/scheduler/`, `server/src/workers/` |
| API docs | OpenAPI 3 at `GET /api/docs` (Swagger UI) and `GET /api/docs.json` | `server/src/api/@system/docs` |
| Tests | Jest (server `test/{unit,api,integration,smoke}`, client `src/test`), Playwright (`e2e/`) | [docs/TESTING.md](./docs/TESTING.md) |
| Deploy | Root `Dockerfile` (Express serves API + `client/dist` on port 3000) -> GitHub Actions -> ECR -> AWS App Runner | [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) |

---

## Repository layout

```
brand.json                    Brand source of truth (written by Orkosi provisioning)
scripts/prebuild.js           Runs before every build: apply-brand.js (+ scripts/@custom/prebuild.js if present)
scripts/apply-brand.js        brand.json -> brand.css tokens + generated client config
scripts/@system/              Template tooling: sync-upstream.sh, check-system-sync.sh, generate-barrels.js, dev/*, ci/*
scripts/@custom/              Your scripts
client/
  webpack.config.mjs          Bundler config (aliases: @ -> src, @system/@custom -> components)
  index.html                  HTML template; brand name/tagline/colour injected by HtmlWebpackPlugin
  src/main.jsx                Entry: validateEnv -> initSentry -> brandPrePaint -> <App/>
  src/config/{@system,@custom}/info.js   Product identity (name, logo, defaultTheme, plans)
  src/app/routes/{@system,@custom}       Route tables; @custom wins by path
  src/app/pages/{app,static}/{@system,@custom}
  src/app/components/{@system,@custom}   @system/ui = shadcn primitives
  src/app/content/{@system,@custom}      Per-page copy modules (landing, pricing, auth)
  src/app/config/{@system,@custom}/text  Deep-merged UI strings
  src/app/styles/@system/general.css, @custom/brand.css (generated), @custom/general.css
server/
  src/app.js                  Express app: the middleware order lives here
  src/index.js                Boot: migrations -> env validation -> DB/Redis -> scheduler -> GraphQL -> listen
  src/api/{@system,@custom}   Route modules (paths are relative to /api)
  src/routes/@system/mergeRoutes.js      @custom router mounted before @system
  src/db/{migrations,repos,schemas}/{@system,@custom}
  src/lib/@system/            Middleware, Validation (zod), Helpers, RateLimit, PostgreSQL, Email, Stripe, ...
  src/lib/@custom/            tenantContext.js, Env/
  test/{unit,api,integration,smoke}
e2e/{@system,@custom}         Playwright specs
docs/                         Everything else (start at docs/INDEX.md)
.github/workflows/            ci.yml, deploy.yml, preview.yml, preview-cleanup.yml
buildspec-ci.yml, buildspec-cd.yml   AWS CodeBuild equivalents of the two workflows
```

---

## @system vs @custom in ten lines

1. Every directory with an `@system/` sibling also has an `@custom/` sibling (`npm run set-customs` creates missing ones).
2. `@system/` is template code, overwritten by `scripts/@system/sync-upstream.sh` (three-way merge, `@sync-guard` regions preserved). Do not edit it in a product repo.
3. `@custom/` is product code. Sync never touches it. Dependencies you removed or pinned are protected by `.template-sync-protect.json`.
4. Server routes: `mergeRoutes(systemRouter, customRouter)` mounts `@custom` first, so a `@custom` route with the same method + path wins.
5. Client routes: `mergeRoutes()` in `routes/@system/utils.js` keys routes by `path`; `routes/@custom/index.jsx` entries replace `@system` entries.
6. Components: `components/index.js` re-exports `@system` then `@custom`; a same-named `@custom` export shadows the `@system` one.
7. Config: `client/src/config/index.js` spreads `@custom/info` over `@system/info` and deep-merges `text`.
8. Content: `lib/@system/content.js` loads `content/@system/<key>.js` then `content/@custom/<key>.js`; `@custom` keys win.
9. Styles: `index.css` imports `@system/general.css`, then `@custom/brand.css`, then `@custom/general.css`; later wins.
10. Migrations: `@system/*.js` run first, then `@custom/*.js`, lexicographic within each, tracked in `schema_migrations`.

Details and a minimal example for every seam: [docs/CUSTOM-OVERRIDES.md](./docs/CUSTOM-OVERRIDES.md).

---

## Brand pipeline in ten lines

1. `brand.json` at the repo root is the only place brand values live (`companyName`, `slug`, `tagline`, `description`, `primaryColor`, `accentColor`, `brandFonts{heading,body,mono}`, `defaultTheme`, logo/favicon paths, `securityHeaders.contentSecurityPolicy`).
2. Orkosi provisioning writes it from the brand wizard; you may edit it by hand afterwards.
3. `node scripts/prebuild.js` runs before every build (npm `prebuild` hook at the root, Dockerfile stage 2, CI).
4. It calls `scripts/apply-brand.js`, which derives full light and dark palettes (WCAG auto-contrast for text on primary).
5. Output 1: `client/src/app/styles/@custom/brand.css` with shadcn HSL tokens and `--brand-*` tokens on `:root`, `[data-theme="dark"]`, `[data-theme="light"]`, plus `--font-heading/--font-body/--font-mono`.
6. Output 2: `client/src/config/@custom/info.js` (generated: name, tagline, logo, `defaultTheme`, `brandColor`, `accentColor`).
7. Webpack injects name, tagline, description and colour into `client/index.html` at build time.
8. Runtime theme switch is `<html data-theme="light|dark">` (the `.dark` class is mirrored for compatibility); `ThemeProvider` persists `app-theme` in localStorage and supports `system`.
9. In JSX use Tailwind brand classes (`bg-brand-primary`, `text-brand-text`, `bg-brand-surface`, `border-brand-border`) or shadcn semantic classes (`bg-primary`, `text-muted-foreground`): both resolve to the same generated tokens.
10. Never hardcode hex in components; change `brand.json` and rebuild.

Details: [docs/BRANDING.md](./docs/BRANDING.md) and [docs/DESIGN-SYSTEM.md](./docs/DESIGN-SYSTEM.md).

---

## Testing

```bash
(cd client && npm run lint)            # ESLint
(cd client && npm test)                # Jest + jsdom, client/src/test/**
(cd server && npm test)                # Jest, all server suites (integration/smoke need a DB or a deployed URL)
(cd server && npm run test:unit)       # unit + api only (ignores integration and smoke)
npm run build                          # prebuild.js then production Webpack build
npx playwright test                    # e2e/ against BASE_URL (default http://localhost:3000)
```

Add your tests under `server/test/unit/@custom/`, `server/test/api/@custom/`, `client/src/test/@custom/`, `e2e/@custom/`. See [docs/TESTING.md](./docs/TESTING.md).

---

## Deploy

Push to `main` -> `.github/workflows/ci.yml` (lint, client tests, server tests, build, Docker smoke) -> `.github/workflows/deploy.yml` builds the root `Dockerfile`, pushes `:sha` and `:latest` to ECR, and calls `aws apprunner start-deployment`. Required repository secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `ECR_REPO_NAME`, `APP_RUNNER_SERVICE_ARN`. Orkosi sets these when it provisions the repo. Health: `GET /api/health`. Full guide and rollback: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

---

## Documentation

| Doc | Read it when |
|---|---|
| [CLAUDE.md](./CLAUDE.md) | You are an AI agent, or you want the rules on one page |
| [docs/INDEX.md](./docs/INDEX.md) | You want the map of everything |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Request lifecycle, client bootstrap, override chain |
| [docs/CUSTOM-OVERRIDES.md](./docs/CUSTOM-OVERRIDES.md) | You need to override something without touching `@system` |
| [docs/BRANDING.md](./docs/BRANDING.md) | Colours, fonts, logo, theme |
| [docs/API.md](./docs/API.md) | Auth methods, error shape, pagination, adding a validated route |
| [docs/SECURITY.md](./docs/SECURITY.md) | Headers, CSRF, CORS, rate limits, validation, tenant scoping |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | CI/CD, env vars, rollback |
| [docs/TESTING.md](./docs/TESTING.md) | Test layers and commands |
| [docs/RUNBOOK.md](./docs/RUNBOOK.md) | Something is on fire |
