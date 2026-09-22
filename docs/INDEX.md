# Documentation index

> Purpose: one line per document so you can find the right one in ten seconds. Links are verified by `npm run docs:check` (`scripts/check-doc-links.mjs`).
> Last verified: 2026-09-20.

## Start here

- [INFORMATIONAL-SPEC.md](INFORMATIONAL-SPEC.md) — **what this template is**: the content-driven front door (`SitePage` sections, `site.js` content model, contact pipeline, imported-sites contract) and which SaaS modules stay off.
- [../README.md](../README.md) — 5-minute quickstart, stack, layout, deploy summary.
- [../CLAUDE.md](../CLAUDE.md) — the agent guide: rules, override chain, copy-paste patterns, where-to-put-things, PR checklist.
- [DEVELOPMENT.md](DEVELOPMENT.md) — local setup in depth, env files, common commands, troubleshooting.

## Architecture and customisation

- [ARCHITECTURE.md](ARCHITECTURE.md) — request lifecycle (middleware order from `server/src/app.js`), client bootstrap, @system/@custom override chain.
- [CUSTOM-OVERRIDES.md](CUSTOM-OVERRIDES.md) — a verified minimal example for every override seam: route, page, component, text, content, style token, migration, scheduler task, worker, env var.
- [ADDING-A-PAGE.md](ADDING-A-PAGE.md) — the short version of "add a page": component + route + sidebar entry.
- [MIGRATIONS.md](MIGRATIONS.md) — migration runner, ordering, commands, rollback, recovery.
- [API.md](API.md) — auth methods, error shape, pagination/sort/filter helpers, OpenAPI endpoint, how to add a validated route.
- [AUTH.md](AUTH.md) — JWT + refresh rotation, OAuth, email verification, password reset, TOTP, sessions (used by the admin inbox).
- [TEAMS.md](TEAMS.md) — teams module (disabled by default via `brand.json` `modules.teams`).
- [protocols/21-component-folder-pattern.md](protocols/21-component-folder-pattern.md) — `ComponentName/index.jsx` folder convention.

## Brand and UI

- [BRANDING.md](BRANDING.md) — the brand pipeline end to end: `brand.json` schema, what Orkosi writes, `prebuild.js` / `apply-brand.js`, theme switch, how to change colours, fonts, logo, theme.
- [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) — the generated token list in `brand.css`, light/dark, Tailwind mappings, shadcn usage, responsive utilities.
- [brand-assets.md](brand-assets.md) — logo, favicon and OG image files: inputs, generator script, where they are served from.
- [SYSTEM_COMPONENTS_API.md](SYSTEM_COMPONENTS_API.md) — prop reference for every `components/@system/*` component.
- [UX_COMPONENTS_GUIDE.md](UX_COMPONENTS_GUIDE.md) — dashboard, onboarding and settings component usage.
- [MOBILE_PATTERNS.md](MOBILE_PATTERNS.md) — mobile-first layout, form, table and modal patterns (`MobileTable`, `/app/mobile-demo`; breakpoints and utilities are in DESIGN-SYSTEM.md section 5).

## Operations

- [DEPLOYMENT.md](DEPLOYMENT.md) — GitHub Actions -> ECR -> App Runner, required secrets and env vars, Dockerfile stages, `start.sh` migration policy, rollback, health endpoints.
- [RUNBOOK.md](RUNBOOK.md) — incident recipes: deploy failed, DB degraded or migration failed, auth misconfigured, CSRF/CORS, brand not applied, App Runner rollback, backup/restore drill, contact-submission export, RPO/RTO.
- [UPGRADING.md](UPGRADING.md) — how a customer repo takes a new template version (@system-only merge, conflict policy, prebuild, migrations, verification).
- [TESTING.md](TESTING.md) — unit / api / integration / smoke / client / e2e layers, commands, how CI gates.
- [SECURITY.md](SECURITY.md) — headers and CSP, CSRF, CORS, rate limiting, validation, auth cookies, tenant scoping, secrets.
- [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) — the pre-release checklist version of SECURITY.md.
- [GIT_WORKFLOW.md](GIT_WORKFLOW.md) — branches in the template repo vs customer repos, commit conventions, template sync.
- [QA.md](QA.md) — QA strategy and manual release checklist.

## Feature inventory

- [CORE-FEATURES-CHECKLIST.md](CORE-FEATURES-CHECKLIST.md) — infrastructure modules inherited from the SaaS foundation (email queue, storage, notifications, audit log, feature flags) and where each lives.

## Legal templates

- [legal/dpa-template.md](legal/dpa-template.md) — generic Data Processing Agreement with `{{COMPANY_NAME}}` placeholders; the `/dpa` page renders product-specific text.

## Reports

- [reports/README.md](reports/README.md) — layout for market research, competitor analysis, QA and performance reports.

## Conventions for docs

- Every doc starts with a purpose line and a "Last verified" date.
- Commands must be copy-pasteable from the repo root unless a `cd` is shown.
- Do not commit task summaries, audits or "completion" files; they belong in the task tracker, not in the template (see [README.md](README.md) in this directory).
- Run `npm run docs:check` before opening a PR that touches Markdown; CI fails on broken relative links.
