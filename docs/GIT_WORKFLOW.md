# Git workflow

> Purpose: branches and merge rules for the template repo and for customer repos, commit conventions, and how template changes reach products.
> Last verified: 2026-09-20 (`.github/workflows/*.yml`, `scripts/@system/sync-upstream.sh`, `.github/CODEOWNERS`).

## 1. Template repo (`Assimetria/product-template`)

| Branch | Role | Protection |
|---|---|---|
| `main` | Stable. What Orkosi forks for new customers and what `sync-upstream.sh` pushes to products. Tagged releases (`VERSION`, `CHANGELOG.md`). | PR + review (`.github/CODEOWNERS`: workflows need the owner's review); CI green |
| `dev` | Integration branch. Agent work lands here first. | CI runs on PRs to `main` only; keep `dev` buildable anyway |
| `feat/*`, `fix/*`, `docs/*`, `wip/*` | Short-lived branches off `dev` | merge into `dev` via PR |

Flow: branch from `dev` -> PR into `dev` -> when stable, PR `dev` -> `main` with a `CHANGELOG.md` entry and a `VERSION` bump (release agent owns those files) -> tag. Hotfixes branch from `main`, merge to `main`, then back-merge `main` into `dev`.

Do not commit directly to `main`. Do not commit generated build artifacts except the brand outputs (`client/src/app/styles/@custom/brand.css`, `client/src/config/@custom/info.js`, `client/src/config/{brand,design}.js`, root `brand.js`) which are committed so the repo builds without a prebuild step in editors.

## 2. Customer repos (`Assimetria/customer-<slug>`)

Orkosi creates the repo with default branch `dev`. Deployment is tied to `main`:

- `.github/workflows/ci.yml`: push and PR to `main`.
- `.github/workflows/deploy.yml`: push to `main` -> ECR -> App Runner.
- `.github/workflows/preview.yml`: PRs to `main` get an ephemeral App Runner preview; `preview-cleanup.yml` removes it on close.

Recommended flow: work on `dev` (or `feat/*` -> `dev`), open a PR `dev` -> `main` to get a preview URL and CI, merge to deploy. Small teams may work on `main` directly; every push to `main` deploys, so keep `main` green.

Only `@custom/`, `brand.json`, assets and product docs should change in a customer repo. Changes to `@system/` belong in the template; if a product must patch `@system` urgently, wrap the block in `// @sync-guard:<name>` ... `// @end-sync-guard` so the next sync preserves it, and open a template PR.

## 3. Template sync

From a template checkout: `scripts/@system/sync-upstream.sh /path/to/customer-repo` (no args: every sibling directory with `server/src`). It finds the last "sync with product-template" commit in the product, overwrites unmodified `@system` files, three-way merges modified ones (`git merge-file`), and never touches `@custom/` or `@sync-guard` regions. `.template-sync-protect.json` lists dependencies sync must not re-add (`removed_deps`) or downgrade (`pinned_deps`). Verify with `scripts/@system/check-system-sync.sh`. Commit the result in the product as `chore: sync with product-template <sha>`.

## 4. Commits and PRs

Conventional Commits: `type(scope): subject`, types `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`. Scope is optional (`client`, `server`, `brand`, `deploy`). Subject in the imperative, no trailing period. Reference the Orkosi task id in the body when there is one.

PR template: `.github/pull_request_template.md` (mirrors the CI gates). Squash-merge feature branches; merge-commit `dev` -> `main` so history stays traceable to releases.

## 5. Things that are not branches

- Previews are per-PR App Runner services, not branches.
- Rollback is an ECR retag or a `git revert` on `main` (`docs/DEPLOYMENT.md` section 6), never a force-push.
- `wip/*` branches from parallel agent sessions are merged by the coordinating session; do not rebase another session's branch.
