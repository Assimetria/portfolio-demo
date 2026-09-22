## Summary

<!-- What changes and why. Link the task or issue. -->

## Type

- [ ] Bug fix
- [ ] Feature
- [ ] Refactor
- [ ] Docs / config
- [ ] CI / infra (`.github/workflows`, `Dockerfile`, `buildspec*.yml`)

## Checklist (mirrors `.github/workflows/ci.yml`)

- [ ] `cd client && npm run lint` passes
- [ ] `cd client && npm test` passes
- [ ] `cd server && npm run test:unit` passes (and `npm test` if integration/smoke are relevant)
- [ ] `npm run build` passes (prebuild + production Webpack build)
- [ ] Docker image builds and `GET /api/health` returns `status: ok` locally (required for server/Dockerfile/start.sh changes)
- [ ] Code is in `@custom/` (product repo) or intentionally in `@system/` (template repo); no hand edits to generated files (`brand.css` tokens, `config/@custom/info.js`, `@system` barrels)
- [ ] Mutating routes have zod validation; SQL uses `$1` placeholders; tenant-owned queries are scoped
- [ ] Schema changes include an idempotent migration in `server/src/db/migrations/@custom/`
- [ ] `brand.json` changes: `npm run prebuild` was run and the regenerated outputs (`client/src/app/styles/@custom/brand.css`, `client/src/config/@custom/info.js`) are committed
- [ ] New env vars documented in the root `.env.example` (CI drift check) and `server/.env.example`; `REQUIRED_VARS` if mandatory; no secrets committed
- [ ] Docs updated where behaviour changed (`CLAUDE.md`, `docs/*`) and `npm run docs:check` passes; `CHANGELOG.md` entry if user-visible

## Screenshots / evidence

<!-- UI changes: light and dark theme. API changes: sample request/response. -->
