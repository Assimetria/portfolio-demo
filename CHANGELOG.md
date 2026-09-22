# Template Changelog

## v2.1.0 (2026-09-20) — Template versioning + brand.json contract

Template versioning + brand.json contract. Products generated before this version
show "Version 2.1.0 available" in the Orkosi dashboard once this is tagged; the
upgrade only touches template-owned files (see `docs/TEMPLATE-VERSIONING.md`).

### Quality audit — F→A+ pass (2026-09-20)
Thirty-parameter audit with fixes. The fork had been cut before the SaaS template's v2.0.0 A+ pass, so the
first step was merging those 46 upstream commits (honest CI gates, deploy gated on CI, App Runner port,
production error handler, provider stack, RLS, Railway/nginx removal).
- Contact path: `ContactRepo`, `{ data, pagination }` envelope, `DELETE /api/contact/:id` (GDPR erasure),
  `PATCH /:id/unread`, 503 instead of an empty 200 when the table is missing, `retention_expires_at` +
  daily purge (`site.contact.retentionDays`, default 180), opt-in Cloudflare Turnstile (site key in
  `brand.json`, `TURNSTILE_SECRET_KEY`), CSRF token flow through the shared API client (the public form
  used to 403 in production), API + component tests.
- Feature modules: `brand.json` `modules` (billing, teams, selfRegistration, apiKeys, web3, ai, usage,
  onboarding, blog, webhooks — all off for this template) gate the server route barrel, the SaaS migrations,
  scheduler tasks, client routes/navigation and the CSP defaults (Stripe hosts only with billing on);
  self-registration returns 403 when off. Gated, not deleted, so upstream merges stay clean.
- SEO / site content: `brand.json` `site` block (locale, nav, contact, social, footer, seo, analytics)
  → generated `content/@generated/site.brand.js`, merged between `@system` defaults and `@custom`;
  `index.html` head, `LocalBusiness`/`ProfessionalService` JSON-LD, `<html lang>` and the no-JS fallback are
  generated from it (the SaaS placeholder copy is gone); build-time prerender of `/` and custom routes
  (Chromium in CI and in the Docker builder stage); immutable caching for hashed assets; `/contact` redirects
  to `/#contact`; imported-site CSS scoped to `[data-imported-root]`; performance budget fails the build.
- Shared platform fixes (with the shop template): TOTP enforced on `/api/auth/login`, API-key CSRF
  exemption strips ambient cookies, `CSRF_SECRET` required in production, `/api/ready`, CI on `dev`,
  fail-fast env, `STORAGE_PROVIDER=local` refused in production, `.env.example` drift test, Dependabot +
  `npm audit` job, empty CSP arrays fall back to defaults.
- Hygiene: `.nvmrc` as the single Node version, `$PORT`-aware HEALTHCHECK, fatal migrations at boot
  (`ALLOW_MIGRATION_FAILURE=1` to override), `.env.example` reorganised around the informational set,
  stale SaaS docs removed, `docs/UPGRADING.md`, `npm run docs:check` link checker, operations runbook
  (rollback, restore drill, contact export, RPO/RTO), `scripts/restore-db.sh`.

### Versioning (new)
- `VERSION`, `template-manifest.json`, root `package.json` and the `## vX.Y.Z` CHANGELOG
  section are one version, written only by `node scripts/@system/version.js` (`--bump`,
  `--check`, `--changelog`, `--json`). CI job `contract` fails when they disagree.
- `template-manifest.json` gains `templateSlug`, `templateRepo`, `upstream`, `versioning`
  and `ownership` (globs: `system` = template wins, `custom`/`customer` = product wins,
  `merge` = 3-way). Orkosi reads `ownership` from the manifest at the target tag.
- `.github/workflows/release.yml`: a `VERSION` change on `main` creates the annotated tag
  `vX.Y.Z` and a GitHub Release whose body is the CHANGELOG section. Runs only in the
  template repository, never in customer repos.
- `scripts/@system/upgrade-from-template.js`: developer CLI applying the same ownership
  rules file-by-file between two template tags (customer repos share no git history with
  the template). `scripts/@system/template-ownership.js classify <path>` explains a path.
- `GET /api/health` now returns `template: { slug, repo, version }`.

### brand.json (contract hardened)
- Validated on every build by `scripts/lib/brand-schema.cjs` (JSON Schema mirror
  `brand.schema.json`); a wrong type on a consumed key fails the build with the path.
  Unknown keys pass through. `node scripts/apply-brand.js --check` validates alone.
- New keys: `spacing` (`compact` / `comfortable` / `spacious` or 0.75–1.5 → `--space-*`,
  `--space-scale`), `radius` (`none` / `sm` / `md` / `lg` / `xl` / `full` or CSS length →
  `--radius`, `--radius-xs…lg`; alias `borderRadius`), `modes.light` / `modes.dark`
  (brand-engine palettes override the derived theme per mode: primary, accent, bg,
  surface, surfaceRaised, text, textMuted, textFaint, border, primaryHover, onPrimary).
- Defaults are byte-stable: an unchanged brand.json produces the same `brand.css` apart
  from the new `--space-scale: 1` token.

### What changed for your team
- Nothing to do for existing products; run `node scripts/@system/upgrade-from-template.js --dry-run`
  to preview the upgrade, or use Settings → Template Version in the Orkosi dashboard.

## v2.0.0 (2026-09-20) — Informational Website Template

Forked from `Assimetria/product-template` (d820c615) as `Assimetria/product-template-informational`. The SaaS foundation (auth, admin, legal pages, theme, brand pipeline, CI, Docker) is kept; the front door becomes a content-driven informational website.

### Site (front door)
- `/` now renders `SitePage`: Hero → About → Services → Team → Testimonials → Contact (+Map) → Footer, each gated by `site.features` flags. SaaS `LandingPage` kept at `/saas-landing` (robots-disallowed).
- Content model `client/src/app/content/@system/site.js` (fictional "Northwind Advisory" defaults) deep-merged with `content/@custom/site.js`; exported as `site` / `useSite()` from `@/config`.
- Components `components/@system/site/`: `SiteNavbar` (mobile drawer, theme toggle, Login hidden unless `showAuth`), `Hero`, `About`, `Services` (lucide icon names with safe fallback), `Team`, `Testimonials`, `ContactSection`, `ContactForm` (real POST, client validation, honeypot, success/error states), `MapEmbed` (OpenStreetMap iframe with no API key; Google via `embedUrl`; address fallback), `SiteFooter`, `SmartLink`.
- `pages/static/@custom/SitePage` delegate for per-product composition.

### Contact pipeline
- `POST /api/contact` (rate limited 5/15 min, zod validation, honeypot), `GET /api/contact` + `PATCH /api/contact/:id/read` (admin). Table `contact_submissions` (schema + migration 030). Notification email to `CONTACT_NOTIFY_EMAIL || EMAIL_FROM`; email failure never fails the request.
- Admin inbox `pages/app/@system/ContactSubmissionsPage` at `/app/contact`; sidebar entry with `requiredRole: 'admin'` — the Sidebar now actually enforces `requiredRole`.

### Imported-sites contract
- `client/src/app/pages/@custom/imported/`, `client/src/app/styles/@custom/imported/`, `client/public/imported/assets/` (+ `.gitkeep`) for Orkosi's website cloner; routes via `routes/@custom/index.jsx` `customRoutes`. Documented in `docs/INFORMATIONAL-SPEC.md`.

### Fixes to the inherited foundation
- **Dark mode never applied**: Tailwind is configured with `darkMode: ['selector', '[data-theme="dark"]']` and `brand.css` flips tokens on `[data-theme]`, but nothing set the attribute (ThemeProvider only toggled `.dark`). `ThemeProvider` and `brandPrePaint.applyDefaultTheme` now set `data-theme`.
- **brand.json CSP ignored**: `Middleware/security.js` and `server/scripts/inject-nginx-csp.js` read snake_case (`security_headers.content_security_policy.script_src`) while brand.json is camelCase. Both now read camelCase (snake_case fallback) and honour new `frameSrc` / `imgSrc`.
- Client tests `config-resolver` and `footer-brand` assert against `brand.json` instead of hard-coded SaaS strings.

### Brand / SEO / docs
- `brand.json`: informational identity, `templateType`, `defaultTheme: "light"`, `frameSrc` (`'self'`, openstreetmap.org, google.com), `imgSrc` (`'self'`, `https:`, `data:`).
- `client/public/sitemap.xml`, `robots.txt`, server `/sitemap.xml` reduced to real informational routes.
- `README.md`, `CLAUDE.md`, `docs/INFORMATIONAL-SPEC.md`, `template-manifest.json` (site-001…site-008, contact-001), `e2e/site.spec.js`, unit tests for contact validation and CSP loading.
## Upstream v2.0.0 (2026-09-20) — SaaS template A+ pass (merged into the informational template)

A coordinated pass across every workstream of the template. If your product was
generated before this date, run the template sync and read the "What changed for
your team" notes in each section.

### Server
- GraphQL subscriptions import `graphql-ws/use/ws` (graphql-ws 6 no longer exports
  `lib/use/ws`); the server used to log "GraphQL setup failed" and boot without GraphQL.
- CSP: the unit test asserted nginx configs and a `start.sh` hash step that no longer
  exist; it now tests `buildCspDirectives` and the built `index.html` (no inline
  executable scripts, no sha256 in `script-src`). `server/scripts/inject-nginx-csp.js`
  removed.

### Security & stability
- Server boots **degraded instead of crashing** when the database is unreachable
  (`/api/health` → `{ status: "degraded", db: "disconnected" }`, still HTTP 200), so
  App Runner keeps the instance up while RDS or credentials are still settling.
- Migrations run **exactly once** per container start (`start.sh` runs them, then sets
  `SKIP_STARTUP_MIGRATIONS=1` for the server).
- Ephemeral RS256 JWT keys and CSRF secret are generated when none are configured —
  a fresh deploy never boots without signing keys.
- Hardened env validation, CORS, rate limiting, auth helpers and error responses.

### Tests
- Server (Jest + supertest, mocked DB) and client (Jest + Testing Library) suites are
  **blocking** in CI — no more `|| echo` swallowing failures.
- New Docker smoke test boots the production image without a database and asserts the
  degraded health shape, the SPA shell and static assets (`scripts/ci/docker-smoke.sh`).
- Playwright E2E: Chromium by default (`PLAYWRIGHT_ALL_BROWSERS=1` for all four
  projects), `webServer` boots the production build locally so `npm run test:e2e` is a
  one-liner; new `05-brand-and-theme.spec.js` asserts brand.json → `<title>`,
  `html[data-theme]`, `--brand-primary`, the header theme toggle and zero console errors.
  Specs that need a database self-skip without `DATABASE_URL`. Nightly `e2e.yml`.

### Client shell, auth & providers
- `App.jsx` restores the full provider stack that de56e8c9 dropped and documents the
  order: `ThemeProvider → ErrorBoundary → BrowserRouter → BrandProvider → AuthProvider →
  UpgradeProvider → GlobalDateRangeProvider`, plus `SkipToContent`, `Analytics`,
  `AppRoutes` and `Toaster`. Every product built between 2026-09-05 and this release
  rendered only the ErrorBoundary fallback.
- New `BrandProvider` (`store/@system/brand.jsx`) derives runtime brand tokens
  (`--brand-primary`, hover, `--primary`, `--ring`, …) from `info.brandColor` /
  `info.accentColor` and injects them into `<head>`, so an admin brand change or a
  preview can recolour the app without a rebuild. Build-time tokens still come from
  `brand.json` via `apply-brand.js`.
- `/auth` is a new split-panel page (brand panel with animated orbs, feature list and
  optional testimonial; form card with Google OAuth, password visibility toggle,
  strength meter, terms checkbox). All colours and fonts come from brand tokens; the
  panel hides below 1024px. Register fields are `#reg-name`, `#reg-email`,
  `#reg-password`.
- **Production build dropped every `.scss` import.** `client/package.json` declared
  `sideEffects: ["*.css"]` only, so webpack tree-shook side-effect-only `.scss`
  imports and the auth page shipped unstyled (the dev server does not tree-shake).
  `*.scss` is now declared and `verify-build` fails if a stylesheet extension imported
  in `src/` is missing from `sideEffects` or the AuthPage CSS is absent from `dist/`.

### Branding & design system
- `brand.json` (`companyName`, `primaryColor`, `accentColor`, `defaultTheme`,
  `brandFonts.{heading,body,mono}`) is the single source of truth: `prebuild`
  regenerates CSS tokens, `@custom/info.js` and `<title>`; the Google Fonts `<link>`
  and `--font-*` stacks are generated from the same resolver (`scripts/lib/brand-fonts.cjs`).
- Design tokens exposed as CSS custom properties (`--brand-*`), dark/light blocks keyed
  on `html[data-theme]`; the theme ↔ DOM contract lives in one module
  (`lib/@system/themeDom.js`) shared by `brandPrePaint` and `ThemeProvider`.
- `apply-brand.js` opt-out: the generated header used to *mention* `apply-brand: keep`,
  which matched the opt-out check, so the template's own `info.js` was never
  regenerated. The marker must now be its own comment line (`// apply-brand: keep`).

### Docs & onboarding
- Docs rewritten around the real stack (Webpack 5, Express-served SPA, App Runner);
  Railway-era guides, stale task-artifact markdown and duplicate completion summaries
  removed. `e2e/README.md` matches the `.js` specs and the new runner.

### CI/CD & containers (what changed for your team)
- **Deploys are gated on CI.** `deploy.yml` now runs via `workflow_run` only after the
  `CI` workflow succeeds on `main`; a red push never reaches production. Manual redeploy:
  Actions → Deploy → Run workflow.
- `ci.yml` runs lint, client tests, server tests, production build and the Docker smoke
  test **in parallel**, all on Node 22 with npm caching, and folds them into the
  aggregate `ci` status check that branch protection requires.
- Deploy pushes `:<sha>` and `:latest` with BuildKit layer caching (no `--no-cache`),
  calls `aws apprunner start-deployment`, waits for the operation to succeed and the
  service to be `RUNNING`, then verifies `/api/health` (via `APP_HEALTH_URL` or the App
  Runner domain). Required secrets are unchanged: `AWS_ACCESS_KEY_ID`,
  `AWS_SECRET_ACCESS_KEY`, `ECR_REPO_NAME`, `APP_RUNNER_SERVICE_ARN`.
- `buildspec-ci.yml` / `buildspec-cd.yml` mirror the Actions flow for CodeBuild; the
  CD buildspec now targets **port 3000** (was 80) and uses `start-deployment` so the
  runtime env vars configured by provisioning are preserved.
- Dockerfile on `node:22-alpine`: multi-stage, non-root, tini, `HEALTHCHECK`, OCI labels,
  copies only what the runtime needs; `.dockerignore` excludes tests, docs, e2e, git and
  dependencies. `start.sh` fails fast with a clear message if `client/dist/index.html`
  is missing.
- `docker-compose.yml` is the production-like local stack (app + PostgreSQL + Redis);
  `docker-compose.local.yml` runs the databases only for native `npm run dev`.
- Removed: Railway config and deploy scripts (`railway.json`, `.railway/`,
  `.railwayignore`, `scripts/deploy-*.sh`, `recover-deploys.sh`, `sync-deploy-hash.sh`,
  `renew-railway-token.sh`, `set-seed-password-railway-dev.sh`,
  `configure-custom-domain.sh`), nginx-era `client/Dockerfile` and `server/Dockerfile`,
  legacy `buildspec.yml`, PR preview workflows (needed secrets provisioning never sets),
  unused `landing.html` + `landing/` (the SPA serves `/`), `.cursorrules`, empty
  `@system/` dir and the `ENHANCED_*` / `task-*-enhanced` markdown artefacts.
- Root `package.json` scripts trimmed to what works (`build`, `test`, `test:e2e`,
  `docker:*`, brand tooling); `build:railway` / `start:railway` / `deploy*` removed.
- `template-manifest.json` 2.0.0 with corrected stack strings and new
  `devops-003` (CI/CD) + `testing-002` (E2E) features.

## v1.4.0 (2026-04-09)

### Deployment & Infrastructure
- Deploy stale-detection via commit hash comparison (`deploy-now.sh --check`)
- Centralized brand kit in `brands/product-template/`
- Cache-Control headers on all responses + fix duplicate Content-Type on manifest.json
- SPA routes for /changelog, /roadmap, /docs, /docs/api, /careers
- Docker: RS256 key vars in docker-compose (replace stale JWT_SECRET)
- Move node-forge to devDependencies
- Remove orphan SQL migration outside @system runner

### CI/CD
- CI system-check job + route auto-discovery in generate-barrels
- Factory auto-PR flow on product config change from OS
- Auto-commit + auto-PR flow in config.js CLI

### Bug Fixes
- Fix hero "View Pricing" button linking to /#pricing instead of /auth
- Fix brand_fonts population in DB and brand.json
- Fix landing page interactive button elements
- Fix blank page after signup (wrong register endpoint + missing ErrorBoundary)
- Add 401 redirect guard + top-level ErrorBoundary

## v1.3.0 (2026-04-08)

### @system Sync & Auto-Discovery
- rsync-based @system sync replacing git merge approach
- Auto-generated barrel files for routes and pages
- Auto-discover pages in AppRoutes (no more hardcoded imports)
- Server route auto-discovery via generate-barrels

### Auth & Validation
- Integration tests for auth flows and DB health
- Register endpoint input validation (RegisterBody)
- CSRF tests: env-aware cookie name instead of hardcoded `__Host-` prefix
- Auth flow error handling + CI tests for signup/login

### Config & Design
- Centralized design tokens config with semantic text + form styles
- Exhaustive config.js with all design token defaults

### Fixes
- Webpack entrypoint reduced from 569 KiB to 320 KiB via chunk splitting
- Remove stale client/public/logo.png (363KB opaque circle)
- Fix manifest.json icon references (favicon-192.png for 192x192)
- DB connection timeout increased to 10s for Railway stability

## v1.2.0 (2026-03-25)

### Landing & Branding
- Structural favicon pipeline — single source of truth from assets/logos
- Product Template branding injected into landing page at container startup
- Replace Assimetria branding with proper template defaults in OG/meta tags
- Nginx SPA catch-all serves branded 404 instead of raw nginx 404
- Add /changelog and /docs pages, fix broken footer links
- OG/meta branding verification in deploy QA checks

### Deploy Pipeline
- Deploy tracking with last_deploy_hash after successful deploy
- Manual deploy recovery script for GitHub Actions billing failures
- CD workflow: API deploy fallback, token validation, security header verification
- Build-time verification: og:image, favicon, robots.txt, sitemap.xml, security headers, __APP_URL__

### Scheduled Tasks
- Blog publishing, invoice generation, financials report (from Ventures)

### Integrations (from Ventures)
- Full integration parity: Facebook Pixel, GeoIP, Mutex, Ghost, Web3, Communications
- Tier gating, usage billing, notifications, activity feed, blog SEO
- ConversionTracking, FacebookAds, InvoiceXpress, Replicate, Creatomate, Intercom, Analytics
- Remember me, API key scopes, webhooks, OpenAPI docs, RapidAPI

### UI
- shadcn/ui component library adopted across all pages
- useContent hook + content override files for per-product text
- mergeRoutes, isRouteLocked, text/content override, style cascade, config propagation

## v1.1.0 (2026-03-20)

### Auth
- OAuth integration scaffold (Google OAuth, OAuthCallback)
- Password reset form + reset-password API
- Register form component
- Auth-specific rate limiters on register and password-reset
- Handle null password_hash for OAuth users (prevent 500)
- sameSite lax for auth cookies (OAuth compat)
- 2FA/TOTP support + bitwise bug fix

### Pages & Features
- Dashboard page with stats cards, recent activity, quick actions
- OnboardingWizard — 3-step wizard (profile, preferences, team)
- Teams API scaffold + @system migration
- Structured logging (utils/logger.js + morgan HTTP logging)
- JSON-LD Organization structured data
- Billing redirect wiring (plan param → billing)
- Auth/sessions sync + drift detection scripts
- Email Logs tab and Feature Flags with DB persistence
- GDPR compliance and cookie consent

### Infrastructure
- TS→JS/JSX full conversion (JavaScript only)
- ESM import file extensions added
- Dual-server architecture
- Railway deployment health check tooling
- Dev scripts: set-customs, run-db-local, run-docker-local, first-setup
- Migrations: idempotent, non-fatal (server starts even if DB unavailable)
- Correct nginx Alpine config (http.d/ instead of conf.d/)
- Boot order enforcement: DB → Backend → Frontend
- SoftwareApplication JSON-LD schema + build-time verification

## v1.0.0 (2026-03-15)
- Initial versioned release
- Auth: RS256 JWT with rotation + reuse detection
- Stripe: Full billing infrastructure
- CSRF + CORS middleware
- Blog @system module
- Email service
- Credits + transactions system
