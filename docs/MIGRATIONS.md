# Database migrations

> Purpose: how schema changes are written, ordered, applied and rolled back.
> Last verified: 2026-09-20 (`server/package.json`, `server/src/db/migrations/@system/run.js`, `server/src/db/migrations/create.js`, `server/src/index.js`).

## 1. Layout

```
server/src/db/migrations/
├── @system/
│   ├── run.js            the runner used by npm run migrate (apply / --status / --dry-run / --rollback)
│   ├── create.js, precheck.js, start.js
│   └── 001_init.js ... 029_sessions_family_created_at.js   template migrations (synced, do not edit in products)
├── @custom/
│   ├── 001_multi_tenant.js
│   └── 002_user_fields_subscription_attribution.js          product migrations (never overwritten)
├── create.js             scaffolder used by npm run migrate:create
└── run.js                duplicate of @system/run.js kept for compatibility
```

Applied migrations are recorded by file name in `schema_migrations (id, name, applied_at)`.

## 2. Order

The runner scans `@system/` then `@custom/`, sorted lexicographically **within** each directory and never across them: `@custom` schemas reference `@system` tables (`users`, `teams`), so `@custom/001_*` must run after `@system/029_*`. Duplicate file names across directories are skipped with a warning (first wins), so prefix `@custom` migrations with their own sequence (`001_`, `002_`, ...).

Files that are not migrations are excluded by name: `run.js`, `index.js`, `create.js`, `precheck.js`, `start.js`. Only `.js` files are discovered, and **every other `.js` file placed in these directories is treated as a migration** — put helpers elsewhere. Reference `.sql` schemas live in `server/src/db/schemas/`, never in the migrations directories.

## 3. Writing a migration

```bash
cd server && npm run migrate:create -- add_projects_table        # -> src/db/migrations/@custom/003_add_projects_table.js
```

```js
'use strict'

exports.up = async (db) => {
  await db.none(`
    CREATE TABLE IF NOT EXISTS projects (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
  `)
}

exports.down = async (db) => {
  await db.none('DROP TABLE IF EXISTS projects CASCADE')
}
```

`db` is the pg-promise instance (`db.none`, `db.any`, `db.one`, `db.tx`). Rules:

- Idempotent DDL (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP ... IF EXISTS`) so a retried boot never fails.
- Additive first: add nullable column, deploy code that writes both, backfill, then constrain or drop in a later migration. Old and new images run side by side during App Runner deploys.
- No data-dependent logic that assumes a populated table on a fresh database.
- Never edit an applied migration; add a new one.
- Legacy shapes `exports.run = async (db)` and a default-export function are still accepted by the runner.

## 4. Commands (from `server/`)

| Command | Does |
|---|---|
| `npm run migrate` | apply all pending |
| `npm run migrate:status` | applied / pending per file |
| `npm run migrate:dry` | list pending without applying |
| `npm run migrate:rollback` | roll back the most recent migration (needs `down`) |
| `node src/db/migrations/@system/run.js --rollback 3` | last three |
| `node src/db/migrations/@system/run.js --rollback-to 003_password_reset.js` | down to a target |
| `node src/db/migrations/@system/run.js --rollback --dry-run` | preview |
| `npm run migrate:create -- <name>` | scaffold in `@custom/` (`--system` targets `@system/`, template repo only) |

## 5. At server start

`server/src/index.js` runs the runner synchronously before anything else. If it fails it runs `server/scripts/drop-schema-migrations.js` and retries once; if that fails too it logs a warning and **the server still starts** so `/api/health` can report the problem instead of App Runner rolling back forever. Check the startup log for `[startup] Migrations done.` and `/api/health` `db: connected`.

`server/start.sh` (used when running the server directory standalone) has a stricter variant that verifies the `users` table exists; the root `start.sh` used by the Docker image relies on `index.js`.

## 6. Recovery

- `schema_migrations` out of sync with reality on a **local or CI** database: `node server/scripts/drop-schema-migrations.js` then `npm run migrate` (everything re-runs; idempotent DDL makes this safe).
- On production, never drop the tracking table. Inspect with `SELECT name, applied_at FROM schema_migrations ORDER BY applied_at DESC;`, fix the offending object by hand, and insert or delete the row for the migration you reconciled.
- A failed `down`: fix the SQL, re-run `--rollback`; the runner only unrecords a migration after its `down` succeeds.

## 7. Reference SQL

`server/src/db/schemas/@system/*.sql` documents the intended shape of each template table (users, sessions, refresh_tokens, teams, subscriptions, ...). They are documentation and test fixtures, not executed by the runner. Product schema docs go in `server/src/db/schemas/@custom/`.
