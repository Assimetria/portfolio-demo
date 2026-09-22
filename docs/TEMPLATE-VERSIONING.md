# Template versioning — how improvements reach every customer

> Contract between the three product templates (`product-template` SaaS,
> `product-template-shopify`, `product-template-informational`), the customer
> repos generated from them (`Assimetria/customer-<slug>`) and the Orkosi
> platform, which shows "Version X.Y.Z available — upgrade?" in each customer's
> dashboard and performs the upgrade. Verified against this tree on 2026-09-20.

## 1. One version, four files, one tool

| File | Role |
|---|---|
| `VERSION` | Plain semver. The version this checkout is on. Read at runtime by `/api/health` (`template.version`) and by Orkosi (customer repo `VERSION` at HEAD). |
| `template-manifest.json` | `version` (must equal `VERSION`), `templateSlug` (= Orkosi `product_types.slug`: `saas` / `shopify` / `informational`), `templateRepo` (`owner/repo`), `upstream` (for forks of the SaaS template), `versioning` (commands), `ownership` (see §3), plus the feature catalogue. |
| `package.json` (root) | `version` must equal `VERSION`. |
| `CHANGELOG.md` | One `## vX.Y.Z (YYYY-MM-DD) — title` section per version. The section body is the release notes customers read before upgrading. |

Only `scripts/@system/version.js` writes them:

```bash
node scripts/@system/version.js                 # print current version
node scripts/@system/version.js --check         # CI gate: all four agree, contract keys present
node scripts/@system/version.js --json          # machine-readable status
node scripts/@system/version.js --bump minor --title "Better billing" --notes-file notes.md
node scripts/@system/version.js --changelog 2.1.0   # release notes for a version
```

`--check` runs in CI (`contract` job in `.github/workflows/ci.yml`, required by the
aggregate `ci` check) together with `node scripts/apply-brand.js --check`
(brand.json validity). In a customer repo the CHANGELOG may carry the product's
own sections; the check only requires that a section for the current `VERSION`
exists somewhere in the file.

Accepted heading forms (parsed by both the template tooling and Orkosi):
`## v2.1.0 (2026-09-21) — Title`, `## [2.1.0] - 2026-09-21`, `## 2.1.0`.

## 2. Releasing a template version

1. Land the change on `dev`, open a PR to `main` as usual.
2. In the same PR (or a follow-up): `node scripts/@system/version.js --bump patch|minor|major --title "…" --notes-file notes.md`, commit.
3. Merge to `main`. `.github/workflows/release.yml` (triggered by a `VERSION`
   change on `main`) runs `--check`, creates the annotated tag `vX.Y.Z` on that
   commit and publishes a GitHub Release whose body is the CHANGELOG section.
   Idempotent; skips when the tag/release already exists.
4. Orkosi's template-versioning sync (hourly + on demand from the admin page)
   reads the `v*` tags of every `product_types.template_repo`, stores
   version/tag/commit/changelog, and every customer app whose `VERSION` is older
   shows the upgrade banner with the notes of each version in between.

The workflow only tags inside the template repository
(`template-manifest.json.templateRepo == github.repository`), so customer repos
that inherit it never create tags of their own.

Semver meaning for customers: **patch** = safe fixes, no action; **minor** = new
@system features / tokens, review the "What changed for your team" notes;
**major** = breaking changes to a seam in §3 of `CLAUDE.md` (override chain),
migration notes mandatory in the CHANGELOG section.

## 3. Ownership — what an upgrade may touch

Customer repos are created with GitHub "create from template", so they share no
git history with the template. Upgrades therefore work **file by file** between
two template tags, with the category of each path deciding what happens:

| Category | Rule on upgrade | Default globs (`template-manifest.json.ownership`) |
|---|---|---|
| `system` | Template wins: file replaced with the template's version; deleted if the template deleted it. | `**/@system/**`, build tooling (`scripts/apply-brand.js`, `scripts/prebuild.js`, `scripts/lib/**`, `scripts/ci/**`, `client/webpack.config.mjs`, `client/tailwind.config.mjs`, …), `.github/workflows/**`, `Dockerfile`, `start.sh`, `buildspec-*.yml`, `docker-compose*.yml`, `template-manifest.json`, `brand.schema.json`, `VERSION` |
| `custom` | Never touched when the customer has the file; added when they do not (new scaffold). | `**/@custom/**` |
| `customer` | Same as `custom`. | `brand.json`, `assets/**`, `client/public/**`, `README.md`, `CLAUDE.md`, `DOCKER_CLAUDE.md`, `.env*` |
| `merge` | 3-way merge — base = template@from, ours = customer, theirs = template@to (`git merge-file`). Conflicts are left with markers and reported. | everything else (`**`) |

Precedence when several globs match: `custom` → `customer` → `system` → `merge`.
The rules are read from the manifest **at the target tag**, so a template release
can move a file between categories without an Orkosi deploy; when the block is
absent the defaults in `scripts/@system/template-ownership.js` apply.

```bash
node scripts/@system/template-ownership.js classify VERSION brand.json server/src/app.js
node scripts/@system/template-ownership.js rules
```

## 4. Upgrading a customer repo

**From the Orkosi dashboard** (the product path): Settings → Template Version →
Upgrade. Orkosi clones the customer repo, applies §3 between the current and
target tags, pushes a branch and opens a PR (auto-merge when there are no
conflicts and CI is green). Status is visible in the same panel.

**From a developer machine** (same rules, same result):

```bash
node scripts/@system/upgrade-from-template.js --dry-run     # plan
node scripts/@system/upgrade-from-template.js               # to latest, commits when clean
node scripts/@system/upgrade-from-template.js --to v2.3.0
```

It adds a `template` remote (from `templateRepo`), fetches tags, and exits 2 with
the list of conflicted files when manual resolution is needed. After an upgrade
run the normal checklist: `npm run build`, `npm test`, `npx playwright test`.

`scripts/@system/sync-upstream.sh` (copy @system between sibling checkouts) and
`check-system-sync.sh` remain for the template maintainers' local multi-repo
workflow; they are not the customer upgrade path.

## 5. Runtime visibility

`GET /api/health` returns

```json
{ "status": "ok", "version": "2.1.0", "template": { "slug": "saas", "repo": "Assimetria/product-template", "version": "2.1.0" } }
```

so a deployed app reports which template and version it runs without git access.

## 6. Forked templates (Shopify, Informational)

`product-template-shopify` and `product-template-informational` are forks of the
SaaS template. Their manifest carries `upstream: { repo, version }` — the SaaS
version last merged in. Their own version line is independent (they tag their
own `v*`), and their `templateSlug` matches their `product_types` row. Merging
the SaaS template into a fork is a normal `git merge upstream/main` (they DO
share history), after which the fork bumps its own version.

## 7. Files added by this contract (all `system`-owned)

- `scripts/@system/version.js`, `scripts/@system/template-ownership.js`, `scripts/@system/upgrade-from-template.js`
- `scripts/lib/brand-schema.cjs`, `brand.schema.json` (brand.json contract, see `docs/BRANDING.md`)
- `.github/workflows/release.yml`, the `contract` job in `.github/workflows/ci.yml`
- `template-manifest.json` keys `templateSlug`, `templateRepo`, `upstream`, `versioning`, `ownership`
- `/api/health` → `template`
- Tests: `server/test/unit/@system/template-version.test.js`, `template-ownership.test.js`, `client/src/test/@system/brand-schema.test.js`
