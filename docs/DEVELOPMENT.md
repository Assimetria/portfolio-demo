# Development guide

> Purpose: local setup in depth, the env files, day-to-day commands, and troubleshooting. Architecture is in `ARCHITECTURE.md`, customisation in `CUSTOM-OVERRIDES.md`, rules for agents in `../CLAUDE.md`.
> Last verified: 2026-09-20 (`package.json`, `server/package.json`, `client/package.json`, `scripts/@system/dev/*`, `server/.env.example`, `client/.env.example`, `client/webpack.config.mjs`).

## 1. Prerequisites

| Tool | Version | Why |
|---|---|---|
| Node.js | 22 (what CI runs; the Docker image is 20, so avoid 22-only APIs) | client and server |
| npm | 10 | workspaces are installed separately |
| Docker | 24+ | local Postgres/Redis containers, reproducing the production image |
| PostgreSQL | 15+ (container or local) | database |
| Git | 2.40+ | template sync |
| Optional | Stripe CLI (`stripe listen`), AWS CLI (SES/S3/App Runner), Playwright browsers (`npx playwright install`) | |

## 2. Setup

```bash
git clone git@github.com:Assimetria/product-template.git my-product && cd my-product

npm run first-setup
#   npm i                 root tooling (concurrently, playwright, sharp)
#   npm run bootstrap     server/.env + client/.env from the .env.example files; RSA key pair -> server/.keys/jwt_private.pem;
#                         fills JWT_PRIVATE_KEY_FILE, JWT_PUBLIC_KEY, ENCRYPT_KEY, ENCRYPT_IV in server/.env (idempotent)
#   npm run set-customs   creates any missing @custom/ sibling directories
#   npm run db-local      starts Postgres 16 in Docker as container pt-postgres-dev on :5432 (postgres/postgres, db product_template_dev)

(cd server && npm install)
(cd client && npm install)
(cd server && npm run migrate)          # @system then @custom migrations
npm run dev                             # server :3001 (nodemon) + client :3000 (webpack serve, /api proxied to :3001)
```

Step by step instead of `first-setup`: `npm install`, `npm run bootstrap` (or `npm run bootstrap-env` then `npm run generate-keys`), `npm run set-customs`, `npm run db-local` (or `docker compose -f docker-compose.local.yml up -d` for Postgres 15 + Redis 7).

## 3. Environment files

`server/.env` (from `server/.env.example`; every key is commented there). Minimum for local dev:

```bash
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/product_template_dev
REDIS_URL=redis://localhost:6379          # optional; app degrades without it
APP_URL=http://localhost:3000             # the webpack dev server origin (CORS also allows :5173 and :3000 by default)
JWT_PRIVATE_KEY_FILE=.keys/jwt_private.pem   # written by bootstrap
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----   # written by bootstrap
ENCRYPT_KEY=...  ENCRYPT_IV=...           # written by bootstrap
CSRF_SECRET=<32+ random chars>            # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SEED_PASSWORD=TestPassword123!            # for npm run seed
```

Optional integrations: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, `RESEND_API_KEY` or `SMTP_*` or SES keys, `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`, `SENTRY_DSN`, `STORAGE_PROVIDER=local` (default) with `LOCAL_STORAGE_DIR=./uploads`.

`client/.env` (from `client/.env.example`, read at build time by Webpack `DefinePlugin` as `import.meta.env.VITE_*`; the prefix is historical):

```bash
VITE_APP_URL=http://localhost:3000
VITE_API_URL=                         # empty = same-origin /api (dev server proxies it)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_ERROR_TRACKING_DSN=
```

Validation at boot: `server/src/lib/@system/Env` (types/defaults) and `server/src/lib/@custom/Env` (`REQUIRED_VARS` only enforced in production). The root `.env.example` is a superset used by `docker-compose.yml`; the server reads `server/.env`.

## 4. Running

| Command (root) | Does |
|---|---|
| `npm run dev` | server + client concurrently |
| `npm run dev:server` / `npm run dev:client` | one side |
| `npm run docker-local` | `docker compose -f docker-compose.local.yml up --build -d` (infra only despite the message) |
| `cd server && npm run dev` | nodemon on `src/index.js` (migrations run at start) |
| `cd client && npm run dev` | webpack-dev-server on :3000 with HMR; watches `@system`/`@custom` explicitly |

URLs: app `http://localhost:3000`, API `http://localhost:3001/api`, health `http://localhost:3001/api/health`, OpenAPI `http://localhost:3001/api/docs`.

Seed data: `cd server && npm run seed` (`npm run seed:clean` wipes first). Stripe webhooks locally: `stripe listen --forward-to localhost:3001/api/stripe/webhook` and copy the `whsec_` into `server/.env`.

## 5. Everyday commands

| Command | Where | Does |
|---|---|---|
| `npm run build` | root | `scripts/prebuild.js` (brand) then production Webpack build + `client/scripts/verify-build.mjs` |
| `npm run apply-brand` | root | regenerate `brand.css` and `config/@custom/info.js` from `brand.json` |
| `npm run generate-barrels` | root | regenerate `@system` barrel files after adding `@system` components/routes (template repo) |
| `npm run generate:brand-assets` | root | favicons/PNG logos/OG from `assets/logos/logo*.svg` (needs `sharp`) |
| `npm run migrate`, `migrate:status`, `migrate:dry`, `migrate:rollback`, `migrate:create -- <name>` | `server/` | migrations (`docs/MIGRATIONS.md`) |
| `npm run lint` | `client/` | ESLint (`client/eslint.config.mjs`) |
| `npm test` / `npm run test:unit` | `server/` | Jest |
| `npm test` | `client/` | Jest + jsdom |
| `npx playwright test` | root | e2e against `BASE_URL` (default :3000) |
| `npm run typecheck` | root | `tsc --noEmit` in both workspaces (advisory) |
| `scripts/@system/check-system-sync.sh` | product repo | detect `@system` drift from the template |
| `scripts/@system/sync-upstream.sh <product-dir>` | template checkout | push `@system` to a product with three-way merge |

## 6. Conventions

- CommonJS on the server, ES modules on the client. Two-space indent, no semicolons on the server, semicolons optional on the client (follow the file you are in).
- Components: `ComponentName/index.jsx` folders (`docs/protocols/21-component-folder-pattern.md`), named exports, shadcn primitives from `components/@system/ui`.
- Styling: Tailwind classes backed by brand or shadcn tokens; no hex; no inline styles (`docs/DESIGN-SYSTEM.md`).
- Server: routes relative to `/api`, zod on every mutation, pg-promise `$1` placeholders, typed errors (`docs/API.md`).
- Product code in `@custom/`; template code in `@system/` (template repo only). Wiring points: `docs/CUSTOM-OVERRIDES.md`.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`); see `docs/GIT_WORKFLOW.md`.

## 7. Adding features (pointers)

- Page: `docs/ADDING-A-PAGE.md`.
- API route, repo, migration, task, worker: `docs/CUSTOM-OVERRIDES.md`.
- Copy and content: `client/src/config/@custom/text/index.js`, `client/src/app/content/@custom/*.js`.
- Brand: `brand.json` then `npm run apply-brand` (`docs/BRANDING.md`).

## 8. Testing

`docs/TESTING.md` has the layers and CI gates. Quick loop: `(cd client && npm run lint && npm test) && (cd server && npm run test:unit) && npm run build`.

## 9. Deploying

Push to `main` of the customer repo; GitHub Actions builds the Docker image and updates App Runner. Everything else, including env vars and rollback, is in `docs/DEPLOYMENT.md`.

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| `Cannot find module` in server or client after clone | `npm install` inside `server/` and `client/`; `first-setup` does not do it |
| `bootstrap` says `.env` already exists | intended; `npm run bootstrap:force` overwrites |
| API starts but `/api/health` says `db: disconnected` | `npm run db-local`, check `DATABASE_URL` in `server/.env` |
| `auth: misconfigured` in health | `npm run generate-keys`, restart the server |
| 403 CSRF on POST from the app | use `lib/@system/api.js`; check `CSRF_SECRET` set and the API restarted |
| CORS error in the browser | `APP_URL`/`CORS_ORIGINS` must include `http://localhost:3000` (default list already does) |
| Webpack build fails after template sync | `npm run generate-barrels` |
| Migration `relation "users" already exists` | partial state: `dropdb product_template_dev && createdb product_template_dev` (container: `docker exec pt-postgres-dev psql -U postgres -c 'DROP DATABASE product_template_dev' ...`) then `npm run migrate` |
| HMR ignores `@system` edits | restart `npm run dev:client`; the watcher config includes `src/**/@system/**` |
| Playwright cannot find browsers | `npx playwright install --with-deps` |
| Rate limited locally | should not happen: limits are skipped when `NODE_ENV=development`; check the value |

More recipes: `docs/RUNBOOK.md`.
