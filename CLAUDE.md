# CLAUDE.md — Informational Website Template Architecture Reference

> **Read this file before every task.** This is the definitive guide to the Assimetria informational template architecture.

## Project Overview

This project is built on the **Assimetria Informational Website Template** (`Assimetria/product-template-informational`, a fork of the SaaS `product-template`). It produces simple informational websites — consultancies, VC/law firms, restaurants, trades, portfolios — on the same authenticated React 18 + Webpack 5 + Express + PostgreSQL foundation. Auth, admin, legal pages, theme, the brand pipeline and CI are all still here; the **front door (`/`) is `SitePage`**, a single-page site rendered from a content model, with a contact form that lands in an admin inbox.

The template uses a **@system / @custom separation pattern**: template-managed code lives in `@system` directories (read-only, synced from upstream), while product-specific code lives in `@custom` directories (your code, never overwritten).

### What @system / @custom means in this template

| You want to… | Edit |
|---|---|
| Change copy, links, services, team, testimonials, contact details, map, flags | `client/src/app/content/@custom/site.js` (`export default { hero: { title: '…' } }` — deep-merged over `content/@system/site.js`; objects merge, arrays replace) |
| Change page composition (drop/add/reorder sections, wrap in a banner) | `client/src/app/pages/static/@custom/SitePage/index.jsx` (delegates to `@system/SitePage` by default) |
| Add routes / replace `/` with an imported site | `client/src/app/routes/@custom/index.jsx` → `customRoutes` (a `path: '/'` entry replaces SitePage) |
| Product identity, colours, fonts, CSP | `brand.json` (camelCase; Orkosi writes it) → `node scripts/prebuild.js` regenerates `brand.css`, `config/@custom/info.js`, icons |
| Add a custom component | `client/src/app/components/@custom/…` |
| Section components themselves (`Hero`, `Services`, `ContactForm`, `MapEmbed`…) | `client/src/app/components/@system/site/` — template code, do **not** edit in a product |
| Contact API / schema | `server/src/api/@system/contact`, `server/src/db/schemas/@system/contact_submissions.sql`, migration `030_contact_submissions.js` — template code |

Feature flags in `site.features`: `showAuth`, `showBlog`, `showPricing`, `showTeam`, `showTestimonials`, `showMap`, `showContactForm`. Pricing/Stripe are optional and **off** by default; nothing on `/` may require Stripe env vars.

### Imported-pages contract (Orkosi website cloner)

The cloner converts an existing site to React and writes:

- `client/src/app/pages/@custom/imported/<PascalName>/index.jsx` — default-exported React component per page
- `client/src/app/styles/@custom/imported/site.css` — plain `.css` (imported from the JSX; webpack handles `.css` and `.scss`)
- `client/public/imported/assets/…` — served at `/imported/assets/…` (CopyPlugin → `dist/imported/**`; Dockerfile copies `client/dist` wholesale)
- routes in `client/src/app/routes/@custom/index.jsx` via `customRoutes`; `{ path: '/' }` overrides SitePage

Imported pages may reuse `SiteNavbar`, `SiteFooter`, `ContactForm`, `MapEmbed` from `components/@system/site`. Full contract: `docs/INFORMATIONAL-SPEC.md` §6.

### Dark mode

Tailwind uses `darkMode: ['selector', '[data-theme="dark"]']` and `brand.css` flips tokens on `[data-theme="light|dark"]`. `ThemeProvider` and `brandPrePaint.applyDefaultTheme` set the attribute on `<html>`; `brand.json.defaultTheme` is `"light"` for this template. Use `bg-brand-bg / bg-brand-surface / border-brand-border / text-brand-text / text-brand-text-secondary / text-brand-text-muted / bg-brand-primary` — never hex.

---

## Tech stack (verified)

| Layer | Technology | Verified in |
|---|---|---|
| Client | React 18, React Router 6, **Webpack 5** (not Vite), Tailwind 3, shadcn/ui primitives in `components/@system/ui`, lucide-react | `client/package.json`, `client/webpack.config.mjs` |
| Server | Node 22 (CI), Express 4, **pg-promise** with `$1` placeholders, zod 4, helmet, csrf-csrf, express-rate-limit (+ Redis store), pino | `server/package.json`, `server/src/lib/@system/PostgreSQL/index.js` |
| Auth | RS256 JWT access cookie (15 min) + rotating refresh cookie (7 or 30 days), both httpOnly; OAuth Google/GitHub; TOTP; API keys (`X-API-Key`) | `server/src/lib/@system/Helpers/{jwt,cookies,auth}.js` |
| Data | PostgreSQL, custom migration runner tracked in `schema_migrations` | `server/src/db/migrations/@system/run.js` |
| Billing / email / storage | Stripe + Polar; Resend/SMTP/SES/console; S3/R2/local | `server/src/lib/@system/*` |
| Jobs | node-cron scheduler (`BaseTask`), BullMQ workers | `server/src/scheduler/`, `server/src/workers/` |
| Tests | Jest (`server/test/{unit,api,integration,smoke}`, `client/src/test`), Playwright (`e2e/`) | `docs/TESTING.md` |
| CI/CD | `.github/workflows/ci.yml` then `deploy.yml` -> ECR -> AWS App Runner; `buildspec-ci.yml` / `buildspec-cd.yml` are the CodeBuild equivalents | `docs/DEPLOYMENT.md` |

There is no Railway, no nginx, no Knex, no Next.js. The Express process serves the API and `client/dist` on one port (3000 in Docker, 3001 in dev).

---

## Absolute rules

1. **Never edit `@system/` in a product repo.** It is overwritten by `scripts/@system/sync-upstream.sh`. Put changes in the sibling `@custom/` directory. In the template repo itself, `@system/` is where template features live.
2. **All product code goes in `@custom/`** (see the table at the end).
3. **Webpack 5 only.** No Vite, no Next.js, no new bundler config.
4. **pg-promise with `$1, $2` placeholders only.** Never `?`, never string-concatenated SQL. Whitelist column names when building dynamic `SET`/`ORDER BY`.
5. **Every mutating route validates its input with zod** via `validate({ body, query, params })` from `server/src/lib/@system/Validation`.
6. **Every schema change ships a migration** in `server/src/db/migrations/@custom/` (idempotent: `IF NOT EXISTS`). Never reference a column that no migration creates.
7. **Interactive UI uses shadcn primitives** (`@/app/components/@system/ui/*`) or `@system` components, not raw `<button>/<input>/<select>`.
8. **No inline `style={{}}`, no CSS-in-JS, no hardcoded hex colours.** Use Tailwind classes backed by brand tokens (next section). Page-level stylesheets (`import "./index.scss"` next to a page, as `AuthPage` does) are allowed for layout/animation that Tailwind expresses badly — they must use `var(--brand-*)` / `var(--font-*)` tokens only, and their extension must be listed in `client/package.json` `sideEffects` (currently `*.css`, `*.scss`) or the production build silently drops the import. `verify-build` enforces this.
9. **No emoji in UI.** Icons come from `lucide-react`.
10. **Exactly two workspace `package.json` files** (`client/`, `server/`) plus the root one for tooling. Do not add more.
11. **The entry HTML is `client/index.html`** (HtmlWebpackPlugin template). There is no root `index.html`.
12. **Theme default comes from `brand.json` `defaultTheme`** (`light` or `dark`). Do not assume dark-first; design both.
13. **Before opening a PR run the testing checklist** at the end of this file. The build must pass.

---

## Brand & theme contract

- `brand.json` (repo root) is the single source of brand truth. Orkosi provisioning writes it; you may edit it. Canonical keys are camelCase: `companyName`, `slug`, `tagline`, `description`, `primaryColor`, `accentColor`, `brandFonts{heading,body,mono}`, `defaultTheme`, `logoPath`, `faviconPath`, `svgLogoPath`, `thumbnailPath`, `assets{...}`, `securityHeaders.contentSecurityPolicy{scriptSrc,connectSrc}`. Legacy keys (`name`, `colors.primary`, `theme`, `headingFont`) are still accepted.
- `node scripts/prebuild.js` runs before every build (npm `prebuild` hook at the root, Dockerfile stage 2, CI) and calls `scripts/apply-brand.js`, which **regenerates** `client/src/app/styles/@custom/brand.css` (token blocks) and `client/src/config/@custom/info.js`. Do not hand-edit the generated token blocks; hand-written CSS placed after the `[data-theme="light"]` block in `brand.css` is preserved.
- `brand.css` defines, on `:root`, `[data-theme="dark"]` and `[data-theme="light"]`: shadcn HSL tokens (`--background`, `--primary`, `--muted-foreground`, ...) and brand tokens (`--brand-primary`, `--brand-primary-hover`, `--brand-accent`, `--brand-bg`, `--brand-surface`, `--brand-surface-hover`, `--brand-border`, `--brand-border-subtle`, `--brand-border-strong`, `--brand-text`, `--brand-text-secondary`, `--brand-text-muted`, `--brand-text-on-primary`, ...), fonts (`--font-heading`, `--font-body`, `--font-mono`), status colours (`--color-success|error|warning|info`), spacing, radius, shadows, z-index.
- Runtime theme switch: `<html data-theme="light|dark">`; the `.dark` class is mirrored for compatibility. `ThemeProvider` (`client/src/app/store/@custom/ThemeContext.jsx`) persists `app-theme` in localStorage and supports `system`. `client/src/app/lib/@system/brandPrePaint.js` applies theme and brand vars before first paint.
- Tailwind: `darkMode: ['selector', '[data-theme="dark"]']`. Brand classes mapped in `client/tailwind.config.mjs`: `bg-brand-primary`, `bg-brand-primary-hover`, `bg-brand-accent`, `bg-brand-bg`, `bg-brand-surface`, `bg-brand-surface-hover`, `border-brand-border`, `text-brand-text`, `text-brand-text-secondary`, `text-brand-text-muted`, `text-success|error|warning|info`. shadcn semantic classes (`bg-primary`, `text-primary-foreground`, `bg-card`, `bg-muted`, `text-muted-foreground`, `border-border`, `text-destructive`) are equally valid: they map to the same generated tokens. For tokens without a Tailwind shorthand use `bg-[var(--brand-primary-10)]`, `text-[var(--brand-text-on-primary)]`.
- Tailwind opacity modifiers do not work on CSS-variable colours (`bg-brand-primary/20` is a no-op). Use `bg-[color-mix(in_srgb,var(--brand-primary)_20%,transparent)]` or a precomputed token (`--brand-primary-5|10|20`).
- Fonts: heading font applies to `h1`-`h6`, body font to `body`, mono to `code`. Webpack injects brand name/tagline/description/colour into `client/index.html`.
- Logos live in `assets/logos/` (served at `/assets/logos/*`), favicons in `assets/favicons/` (served at `/`), OG images in `assets/og/`. `client/src/config/@system/info.js` defaults `logo` to `/assets/logos/logo-mark.svg`.

Full pipeline: `docs/BRANDING.md`. Token list: `docs/DESIGN-SYSTEM.md`. `brand.json` is validated on every build against `brand.schema.json` / `scripts/lib/brand-schema.cjs` (typed keys fail the build; unknown keys pass through); `spacing`, `radius` and the brand engine's `modes.{light,dark}` are honoured.

---

## Template version & upgrades

`VERSION`, `template-manifest.json` (`version`, `templateSlug`, `templateRepo`, `ownership`), root `package.json` and the `## vX.Y.Z` CHANGELOG section are kept in lock-step by `node scripts/@system/version.js` (`--check` in CI, `--bump` to release). Merging a bump to `main` makes `.github/workflows/release.yml` tag `vX.Y.Z`; Orkosi reads those tags and offers the upgrade to every customer app. Ownership on upgrade: `@system` = template wins, `@custom` + `brand.json`/assets/README/.env = customer wins, everything else 3-way merged. Developer CLI: `node scripts/@system/upgrade-from-template.js [--dry-run]`. Full contract: `docs/TEMPLATE-VERSIONING.md`.

---

## Feature modules (`brand.json` → `modules`)

The SaaS surface inherited from upstream (billing, teams, selfRegistration, apiKeys, web3, ai, usage, onboarding, blog, webhooks) is **gated, never deleted** — deleting it would break `@system` merges. One block in `brand.json` switches each module and this template ships all of them `false`:

- **Absent key = enabled.** Never rely on a module being off unless `brand.json` says so; the SaaS template has no `modules` block and keeps everything.
- **Resolvers:** server `server/src/lib/@system/Helpers/modules.js` (`isEnabled`, `isRouterEnabled`, `isMigrationEnabled`, `requireModule`; maps `ROUTER_MODULES`, `MIGRATION_MODULES`; env override `MODULES_JSON`). Client `client/src/config/@system/modules.js` (`isModuleEnabled`, `filterByModules`; value comes from the webpack `__MODULES__` DefinePlugin constant read from the same `brand.json`; re-exported from `@/config`).
- **Seams driven by it:** `routes/@system/index.js` mounts routers through `mount(name, path)` (generated — edit `scripts/@system/generate-barrels.js`, not the barrel); migration runner skips module-owned files without recording them; `Scheduler.registerTask()` refuses tasks built with `{ module }`; `buildCspDirectives()` adds Stripe hosts only with `billing` on; register endpoints answer `403 MODULE_DISABLED`; client routes/pages carry `module: '<key>'` and are filtered by `filterRoutesByModules()` / `filterPagesByModules()`.
- **When you add a gated thing:** tag it (router in `ROUTER_MODULES`, migration in `MIGRATION_MODULES`, task `{ module }`, route/page `module`). When always-on code must touch a module's table, guard it with `isEnabled()` (see `api/@system/gdpr`). Tests for a module the template switches off set `process.env.MODULES_JSON` for their own file.
- Do not gate `001_init`, `011_onboarding`, `020_billing_infrastructure` — always-on code depends on them. Full table: `docs/INFORMATIONAL-SPEC.md` §4.1.

---

## Override chain (how @custom wins)

| Seam | Mechanism | File |
|---|---|---|
| Server routes | `mergeRoutes(systemRouter, customRouter)` mounts `@custom` **first** under `/api`; first matching Express handler wins | `server/src/routes/@system/mergeRoutes.js`, `server/src/app.js` |
| Server route registration | `router.use(require('../../api/@custom/<file>'))` inside try/catch | `server/src/routes/@custom/index.js` |
| Client routes | `mergeRoutes()` keys by `path`; `customRoutes` entries replace `systemRoutes` entries (children merged recursively) | `client/src/app/routes/@system/utils.js`, `routes/@custom/index.jsx` |
| Components | barrel re-exports `@system` then `@custom`; same-named export shadows | `client/src/app/components/index.js` |
| Identity config | `info = { ...systemInfo, ...customInfo }` (shallow) | `client/src/config/index.js` |
| UI strings | `deepMerge(systemText, customText)` | `client/src/config/index.js` (`text`) and `client/src/app/config/text/index.js` |
| Page content | `loadContent(key)` merges `content/@system/<key>.js` then `content/@custom/<key>.js`; hook `useContent(key)` | `client/src/app/lib/@system/content.js`, `hooks/@system/useContent.js` |
| Sidebar navigation | `mergePages(systemPages, customPages)` by `path` | `client/src/app/config/@custom/navigation.js`, `@system/navigation-merge.js` |
| Styles | `index.css` imports `@system/general.css` -> `@custom/brand.css` -> `@custom/general.css` | `client/src/index.css` |
| Migrations | `@system/*.js` then `@custom/*.js`, lexicographic within each | `server/src/db/migrations/@system/run.js` |
| Scheduler | `scheduler/tasks/@custom/init.js` receives the singleton and calls `registerTask()` | `server/src/index.js` |
| Env validation | `@system/Env` then `@custom/Env` (`REQUIRED_VARS`, `OPTIONAL_VARS`) | `server/src/lib/@custom/Env/index.js` |

Worked examples for every seam: `docs/CUSTOM-OVERRIDES.md`.

---

## Server patterns (copy these exactly)

Route paths are **relative to `/api`** (`app.use('/api', mergeRoutes(...))`). Write `router.get('/projects')`, not `router.get('/api/projects')`.

```js
// server/src/api/@custom/projects.js
const express = require('express')
const { z } = require('zod')
const db = require('../../lib/@system/PostgreSQL')
const { requireAuth } = require('../../middleware/@system/auth')      // alias of Helpers.authenticate
const { validate } = require('../../lib/@system/Validation')
const { asyncHandler } = require('../../lib/@system/Helpers')

const router = express.Router()

const CreateProject = z.object({ name: z.string().min(1).max(120), description: z.string().max(2000).optional() })
const IdParam = z.object({ id: z.coerce.number().int().positive() })

router.get('/projects', requireAuth, asyncHandler(async (req, res) => {
  const rows = await db.any('SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id])
  res.json({ data: rows })
}))

router.get('/projects/:id', requireAuth, validate({ params: IdParam }), asyncHandler(async (req, res) => {
  const row = await db.oneOrNone('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id])
  if (!row) return res.status(404).json({ message: 'Not found' })
  res.json({ data: row })
}))

router.post('/projects', requireAuth, validate({ body: CreateProject }), asyncHandler(async (req, res) => {
  const row = await db.one(
    'INSERT INTO projects (name, description, user_id) VALUES ($1, $2, $3) RETURNING *',
    [req.body.name, req.body.description ?? null, req.user.id],
  )
  res.status(201).json({ data: row })
}))

router.delete('/projects/:id', requireAuth, validate({ params: IdParam }), asyncHandler(async (req, res) => {
  const result = await db.result('DELETE FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id])
  if (result.rowCount === 0) return res.status(404).json({ message: 'Not found' })
  res.status(204).end()
}))

module.exports = router
```

Register it: add `try { router.use(require('../../api/@custom/projects')) } catch (e) { console.error('[custom] projects route failed to load:', e.message) }` to `server/src/routes/@custom/index.js`.

pg-promise methods you will use: `db.any(sql, params)` (0..n rows), `db.one` (exactly 1, throws otherwise), `db.oneOrNone` (0..1), `db.none` (no rows expected), `db.result` (raw result with `rowCount`), `db.tx(t => ...)` (transaction). `req.db` (attached by `attachDatabase` for `/api`) exposes the `@system` repos.

Repository pattern (mirrors `server/src/db/repos/@system/UserRepo.js`):

```js
// server/src/db/repos/@custom/ProjectRepo.js
const db = require('../../../lib/@system/PostgreSQL')

const ProjectRepo = {
  findById: (id) => db.oneOrNone('SELECT * FROM projects WHERE id = $1', [id]),
  listForUser: (userId) => db.any('SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
  create: ({ name, description, userId }) =>
    db.one('INSERT INTO projects (name, description, user_id) VALUES ($1, $2, $3) RETURNING *', [name, description ?? null, userId]),
  update(id, fields) {
    const allowed = ['name', 'description']                       // whitelist, never interpolate user keys
    const entries = Object.entries(fields).filter(([k, v]) => allowed.includes(k) && v !== undefined)
    if (!entries.length) return this.findById(id)
    const sets = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ')
    return db.one(`UPDATE projects SET ${sets}, updated_at = now() WHERE id = $1 RETURNING *`, [id, ...entries.map(([, v]) => v)])
  },
}
module.exports = ProjectRepo
```

Export it from `server/src/db/repos/@custom/index.js`. For zero-boilerplate CRUD see `createCrudRouter` and `BaseRepository` in `server/src/lib/@system/Helpers/README.md`.

Migration:

```js
// server/src/db/migrations/@custom/003_create_projects.js   (scaffold: cd server && npm run migrate:create -- create_projects)
'use strict'
exports.up = async (db) => {
  await db.none(`
    CREATE TABLE IF NOT EXISTS projects (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      description TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
  `)
}
exports.down = async (db) => { await db.none('DROP TABLE IF EXISTS projects CASCADE') }
```

Commands (from `server/`): `npm run migrate`, `npm run migrate:status`, `npm run migrate:dry`, `npm run migrate:rollback`, `npm run migrate:create -- <name>`. Migrations also run automatically at server start (`server/src/index.js`).

Error responses: the global handler in `server/src/app.js` returns `{ message }` (validation adds `errors: [{ field, message }]`). Target shape is `{ message, code?, requestId }` with a generic message for 5xx in production. Throw `AppError`/`NotFoundError`/`ValidationError` from `server/src/lib/@system/Errors` or call `next(err)`; never `res.json` a raw error object.

Tenant scoping: `const { tenantContext, requireTenantRole } = require('../../lib/@custom/tenantContext')` after `requireAuth`. It reads `X-Tenant-Id` (or `?tenant=`), checks membership in `tenant_members`, sets `req.tenant` and `req.tenantRole`. Always add `AND tenant_id = $n` to tenant-owned queries. The Postgres RLS helper `withTenant()` (`SET LOCAL app.current_tenant_id`) is the intended pattern for tenant tables; check `server/src/lib/@custom/` for it before writing your own.

---

## Client patterns

- Pages: `client/src/app/pages/app/@custom/<Name>Page/index.jsx` (authenticated) or `pages/static/@custom/<Name>Page/index.jsx` (public). Export a named component.
- Route: add to `customRoutes` in `client/src/app/routes/@custom/index.jsx`:
  ```jsx
  import { lazy } from 'react'
  import { ProtectedRoute } from '../../components/@system/ProtectedRoute'
  const ProjectsPage = lazy(() => import('../../pages/app/@custom/ProjectsPage').then(m => ({ default: m.ProjectsPage })))
  export const customRoutes = [
    { path: '/app/projects', element: <ProtectedRoute><ProjectsPage /></ProtectedRoute> },
  ]
  ```
  Using an existing `@system` path (e.g. `/pricing`) replaces that page.
- Sidebar entry: add `{ path: '/app/projects', label: 'Projects', icon: 'FolderKanban', sidebar: true, section: 'main', order: 10, requiresAuth: true }` to `pages` in `client/src/app/config/@custom/navigation.js`. The sidebar reads this registry; routes do not (there is no auto-router), so do both.
- API calls: `import { api } from '@/app/lib/@system/api'` then `api.get('/projects')`, `api.post('/projects', body)`. It sends cookies, fetches and attaches the CSRF token, and retries once after a silent refresh on 401.
- Copy: `import { text } from '@/config'` (deep-merged) or `useContent('landing')` for per-page content modules.
- Identity: `import { info } from '@/config'` (`info.name`, `info.logo`, `info.defaultTheme`, `info.plans`).
- Components: `import { Button } from '@/app/components/@system/ui/button'`; own components in `components/@custom/<Name>/index.jsx`, exported from `components/@custom/index.jsx`.
- Aliases (Webpack + Jest): `@` -> `client/src`, `@system` -> `client/src/app/components/@system`, `@custom` -> `client/src/app/components/@custom`.
- Terser: never wrap route elements conditionally at render time; build the wrapped element when the route object is created (as `systemRoutes` does).

---

## Where to put things

| I need to... | Path |
|---|---|
| Add an authenticated page | `client/src/app/pages/app/@custom/<Name>Page/index.jsx` + `routes/@custom/index.jsx` + `config/@custom/navigation.js` |
| Add a public page | `client/src/app/pages/static/@custom/<Name>Page/index.jsx` + `routes/@custom/index.jsx` |
| Override a `@system` page | same `path` in `routes/@custom/index.jsx` |
| Add a component | `client/src/app/components/@custom/<Name>/index.jsx` (+ export in `@custom/index.jsx`) |
| Add a hook | `client/src/app/hooks/@custom/use<Name>.js` |
| Add client API functions | `client/src/app/api/@custom/index.js` |
| Change UI strings | `client/src/config/@custom/text/index.js` or `client/src/app/config/@custom/text/index.js` |
| Change landing/pricing/auth copy | `client/src/app/content/@custom/{landing,pricing,auth}.js` |
| Change name/logo/plans | `brand.json` (regenerates `client/src/config/@custom/info.js`); hand overrides go in that generated file only if you accept regeneration on next build |
| Change colours/fonts/theme | `brand.json` then `npm run apply-brand` |
| Add CSS | `client/src/app/styles/@custom/general.css` |
| Add an API route | `server/src/api/@custom/<name>.js` + register in `server/src/routes/@custom/index.js` |
| Add a repo | `server/src/db/repos/@custom/<Name>Repo.js` + `@custom/index.js` |
| Add a migration | `cd server && npm run migrate:create -- <name>` |
| Add a scheduled task | class in `server/src/scheduler/tasks/@custom/`, register in `@custom/init.js` |
| Add a worker | `server/src/workers/@custom/<name>.js`, export from `@custom/index.js` |
| Require an env var | `REQUIRED_VARS` in `server/src/lib/@custom/Env/index.js` + `server/.env.example` |
| Add a unit / API test | `server/test/unit/@custom/`, `server/test/api/@custom/` |
| Add a client test | `client/src/test/@custom/` |
| Add an e2e test | `e2e/@custom/` |
| Add a script | `scripts/@custom/` (`scripts/@custom/prebuild.js` is auto-run by prebuild) |
| Add images | `client/src/app/assets/images/@custom/` or `assets/` |

---

## Forbidden

| Do not | Do instead |
|---|---|
| Use Vite, Next.js, CRA | Webpack 5 is configured |
| Create `frontend/`, `backend/`, root `index.html`, extra `package.json` | `client/`, `server/`, `client/index.html` |
| Edit `@system/` in a product repo | create the `@custom` override |
| `?` placeholders, Knex, string-built SQL | pg-promise `$1` params, whitelisted columns |
| Skip zod on a POST/PUT/PATCH/DELETE | `validate({ body })` |
| Reference a column without a migration | `npm run migrate:create -- <name>` |
| Raw `<button>`, `<input>`, `<select>` | shadcn `Button`, `Input`, `Select` |
| `style={{}}`, styled-components, emotion | Tailwind classes |
| `bg-[#3B82F6]`, `text-gray-700`, hardcoded hex | `bg-brand-primary`, `text-brand-text-muted`, `bg-primary`, `text-[var(--color-error)]` |
| `bg-brand-primary/20` | `bg-[var(--brand-primary-20)]` or `color-mix()` |
| Emoji or FontAwesome | `lucide-react` |
| Assume dark theme | read `brand.json` `defaultTheme`; test both |
| Hand-edit generated files (`brand.css` token blocks, `config/@custom/info.js`, `*/@system/index.js` barrels) | change the source and rerun `npm run apply-brand` / `npm run generate-barrels` |
| Literal `INSERT` per row for bulk seed data | a loop in `server/src/db/seed.js` or a `@custom` seed script |
| Touch `CHANGELOG.md`, `template-manifest.json`, `VERSION`, `buildspec*.yml`, `.github/workflows/*` | unless the task explicitly says so |
| Commit secrets, `.env`, `server/.keys/` | `.env.example` with placeholders |

---

## Testing checklist before a PR

Run from the repo root; all must pass.

```bash
(cd client && npm run lint)                 # ESLint
(cd client && npm test)                     # client Jest (jsdom)
(cd server && npm run test:unit)            # server unit + api (integration/smoke excluded)
npm run build                               # prebuild.js + production Webpack build
docker build -t pt-local . && docker run --rm -p 3000:3000 -e DATABASE_URL=... pt-local   # optional: what CI's docker smoke does
```

If you touched migrations: `(cd server && npm run migrate:dry)`. If you touched `e2e/`: `npx playwright test`. If you touched `@system/`: `scripts/@system/check-system-sync.sh` must still pass in downstream products.

---

## Repo facts agents get wrong

- `npm run first-setup` does **not** install `client/` or `server/` dependencies; run `npm install` in each.
- Dev ports: API 3001 (`server/.env` `PORT`), Webpack dev server 3000 with `/api` proxied to 3001. Docker: one process on 3000.
- Health endpoints: `GET /health`, `GET /api/health` (DB + JWT probe, always 200 with `status: ok|degraded`), `GET /healthz` (shallow).
- OpenAPI: `GET /api/docs` (Swagger UI), `GET /api/docs.json`.
- CSRF: `GET /api/csrf-token`, then send `X-CSRF-Token` on mutations. Exempt: `/api/sessions/refresh`, `/api/auth/refresh`, webhooks, `/api/gdpr/consent`, `/api/v1/*`, API-key requests.
- Rate limiting is skipped when `NODE_ENV` is `development` or `test`.
- `server/src/db/migrations/@system/run.js` is the runner used by `npm run migrate`; `server/src/db/migrations/run.js` is a duplicate kept for compatibility.
- Docs live in `docs/` (map: `docs/INDEX.md`). Do not create task-summary `.md` files in the repo.
