'use strict'

/**
 * Production Database Migration Runner
 *
 * Tracks applied migrations in a `schema_migrations` table.
 * Discovers migration files from:
 *   - db/migrations/@system/*.js  (platform-level, in-order)
 *   - db/migrations/@custom/*.js  (product-level, in-order)
 *
 * Skips files that are not versioned migration modules (e.g. this file itself).
 *
 * Usage:
 *   node src/db/migrations/@system/run.js                        # apply all pending
 *   node src/db/migrations/@system/run.js --dry-run              # list pending without applying
 *   node src/db/migrations/@system/run.js --status               # show applied/pending status
 *   node src/db/migrations/@system/run.js --rollback             # roll back last 1 migration
 *   node src/db/migrations/@system/run.js --rollback 3           # roll back last 3 migrations
 *   node src/db/migrations/@system/run.js --rollback-to 003_password_reset.js  # roll back to target
 *   node src/db/migrations/@system/run.js --rollback --dry-run   # preview rollback without executing
 */

require('dotenv').config()

const path = require('path')
const fs = require('fs')
const db = require('../../../lib/@system/PostgreSQL')
const { isMigrationEnabled } = require('../../../lib/@system/Helpers/modules')

// ─── Constants ────────────────────────────────────────────────────────────────

const MIGRATIONS_TABLE = 'schema_migrations'

// Files inside this runner's own directory that are not migration modules
const EXCLUDED_FILES = new Set(['run.js', 'index.js', 'create.js', 'precheck.js', 'start.js'])

// Directories to scan for migration files, in resolution order
const MIGRATION_DIRS = [
  path.join(__dirname, '../@system'),
  path.join(__dirname, '../@custom'),
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toISOString()
  console.log(`[migrate][${ts}] ${msg}`)
}

function err(msg) {
  const ts = new Date().toISOString()
  console.error(`[migrate][${ts}] ERROR: ${msg}`)
}

/**
 * Collect all migration files from MIGRATION_DIRS.
 * Returns an array of { name, filePath } in directory order, sorted within each dir.
 * Each `name` is unique across dirs; if duplicates exist the first dir wins.
 *
 * IMPORTANT: We do NOT re-sort across directories. @system migrations must always
 * run before @custom migrations because @custom schemas reference @system tables
 * (e.g. error_events.sql has a FK to users(id) which is created by @system 001_init).
 * A global lexicographic sort would cause @custom 001_error_events.js to run before
 * @system 001_init.js, producing "relation users does not exist" on Railway.
 */
function discoverMigrations() {
  const seen = new Set()
  const migrations = []

  for (const dir of MIGRATION_DIRS) {
    if (!fs.existsSync(dir)) continue

    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.js') && !EXCLUDED_FILES.has(f))
      .sort() // lexicographic order within this directory

    for (const file of files) {
      if (seen.has(file)) {
        log(`WARN: duplicate migration name "${file}" – keeping first occurrence, skipping ${dir}/${file}`)
        continue
      }
      seen.add(file)
      // Feature modules: migrations owned by a module that brand.json switches
      // off (Helpers/modules.js → MIGRATION_MODULES) are dropped from the list
      // here, so they are neither applied nor recorded in schema_migrations.
      // Enabling the module later applies them on the next boot like any
      // other pending migration.
      if (!isMigrationEnabled(file)) {
        log(`Skipping ${file} — its feature module is disabled in brand.json`)
        continue
      }
      migrations.push({ name: file, filePath: path.join(dir, file) })
    }
  }

  // Do NOT sort across directories — @system must run before @custom.
  return migrations
}

// ─── DB bootstrap ─────────────────────────────────────────────────────────────

async function ensureMigrationsTable() {
  await db.none(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
}

async function getAppliedMigrations() {
  const rows = await db.any(`SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY name ASC`)
  return new Set(rows.map(r => r.name))
}

/** Returns applied migration names ordered by applied_at DESC, name DESC (most recent first). */
async function getAppliedMigrationsOrdered() {
  const rows = await db.any(
    `SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY applied_at DESC, name DESC`
  )
  return rows.map(r => r.name)
}

async function recordMigration(name) {
  await db.none(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1)`, [name])
}

async function unrecordMigration(name) {
  await db.none(`DELETE FROM ${MIGRATIONS_TABLE} WHERE name = $1`, [name])
}

// ─── Up runner ────────────────────────────────────────────────────────────────

async function runUp(migration) {
  const mod = require(migration.filePath)

  if (typeof mod.run === 'function') {
    // Legacy single-function style
    await mod.run(db)
  } else if (typeof mod.up === 'function') {
    // Standard up/down style
    await mod.up(db)
  } else if (typeof mod === 'function') {
    // Direct export style
    await mod(db)
  } else {
    throw new Error(
      `Migration "${migration.name}" does not export a run(), up(), or default function.`
    )
  }
}

// ─── Down runner ──────────────────────────────────────────────────────────────

async function runDown(migration) {
  const mod = require(migration.filePath)

  if (typeof mod.down === 'function') {
    await mod.down(db)
  } else {
    throw new Error(
      `Migration "${migration.name}" does not export a down() function. Cannot roll back. ` +
      `Add a down() export or manually revert this migration.`
    )
  }
}

// ─── Apply pending ────────────────────────────────────────────────────────────

async function applyPending(migrations, applied, dryRun = false) {
  const pending = migrations.filter(m => !applied.has(m.name))

  if (pending.length === 0) {
    log('No pending migrations – database is up to date.')
    return 0
  }

  log(`Found ${pending.length} pending migration(s):`)
  pending.forEach(m => log(`  - ${m.name}`))

  if (dryRun) {
    log('[dry-run] Skipping execution.')
    return 0
  }

  let applied_count = 0
  for (const migration of pending) {
    log(`Applying: ${migration.name}`)
    try {
      await runUp(migration)
      await recordMigration(migration.name)
      log(`Applied:  ${migration.name} ✓`)
      applied_count++
    } catch (error) {
      err(`Failed on "${migration.name}": ${error.message}`)
      err('Aborting migration run. Fix the error and re-run.')
      throw error
    }
  }

  log(`Migration run complete. Applied ${applied_count} migration(s).`)
  return applied_count
}

// ─── Rollback ─────────────────────────────────────────────────────────────────

/**
 * Roll back the last `steps` applied migrations (default: 1).
 * Migrations are rolled back in reverse applied order (most recently applied first).
 */
async function rollbackSteps(migrations, steps, dryRun = false) {
  const appliedOrdered = await getAppliedMigrationsOrdered()

  if (appliedOrdered.length === 0) {
    log('Nothing to roll back – no migrations have been applied.')
    return 0
  }

  const toRollback = appliedOrdered.slice(0, steps)

  log(`Rolling back ${toRollback.length} migration(s):`)
  toRollback.forEach(name => log(`  - ${name}`))

  if (dryRun) {
    log('[dry-run] Skipping execution.')
    return 0
  }

  const migrationMap = new Map(migrations.map(m => [m.name, m]))

  let rolled_back = 0
  for (const name of toRollback) {
    const migration = migrationMap.get(name)
    if (!migration) {
      err(`Migration file for "${name}" not found on disk. Skipping.`)
      continue
    }
    log(`Rolling back: ${name}`)
    try {
      await runDown(migration)
      await unrecordMigration(name)
      log(`Rolled back: ${name} ✓`)
      rolled_back++
    } catch (error) {
      err(`Failed rolling back "${name}": ${error.message}`)
      err('Aborting rollback. Fix the error and re-run.')
      throw error
    }
  }

  log(`Rollback complete. Rolled back ${rolled_back} migration(s).`)
  return rolled_back
}

/**
 * Roll back all migrations applied after and including `targetName`.
 * After this command, `targetName` will be unapplied.
 *
 * Example: if applied = [001, 002, 003, 004] and targetName = 003,
 *          rolls back 004 then 003, leaving [001, 002] applied.
 */
async function rollbackTo(migrations, targetName, dryRun = false) {
  const appliedOrdered = await getAppliedMigrationsOrdered() // most recent first

  const targetIdx = appliedOrdered.indexOf(targetName)
  if (targetIdx === -1) {
    err(`Migration "${targetName}" is not in the applied list. Nothing to roll back.`)
    return 0
  }

  // Roll back everything from most recent down to (and including) target
  const toRollback = appliedOrdered.slice(0, targetIdx + 1)

  log(`Rolling back to (and including) "${targetName}" — ${toRollback.length} migration(s):`)
  toRollback.forEach(name => log(`  - ${name}`))

  if (dryRun) {
    log('[dry-run] Skipping execution.')
    return 0
  }

  const migrationMap = new Map(migrations.map(m => [m.name, m]))

  let rolled_back = 0
  for (const name of toRollback) {
    const migration = migrationMap.get(name)
    if (!migration) {
      err(`Migration file for "${name}" not found on disk. Skipping.`)
      continue
    }
    log(`Rolling back: ${name}`)
    try {
      await runDown(migration)
      await unrecordMigration(name)
      log(`Rolled back: ${name} ✓`)
      rolled_back++
    } catch (error) {
      err(`Failed rolling back "${name}": ${error.message}`)
      err('Aborting rollback. Fix the error and re-run.')
      throw error
    }
  }

  log(`Rollback complete. Rolled back ${rolled_back} migration(s).`)
  return rolled_back
}

// ─── Status ───────────────────────────────────────────────────────────────────

async function printStatus(migrations, applied) {
  log('Migration status:')
  log('─'.repeat(60))
  if (migrations.length === 0) {
    log('  No migration files found.')
    return
  }
  for (const m of migrations) {
    const status = applied.has(m.name) ? '✓ applied' : '○ pending'
    log(`  [${status}]  ${m.name}`)
  }
  log('─'.repeat(60))
}

// ─── Argument parsing ─────────────────────────────────────────────────────────

function parseArgs(args) {
  const dryRun = args.includes('--dry-run')
  const statusOnly = args.includes('--status')

  // --rollback [N]
  const rollbackIdx = args.indexOf('--rollback')
  let rollback = null
  if (rollbackIdx !== -1) {
    const next = args[rollbackIdx + 1]
    rollback = (next && /^\d+$/.test(next)) ? parseInt(next, 10) : 1
  }

  // --rollback-to <name>
  const rollbackToIdx = args.indexOf('--rollback-to')
  let rollbackToName = null
  if (rollbackToIdx !== -1) {
    rollbackToName = args[rollbackToIdx + 1] || null
    if (!rollbackToName) {
      throw new Error('--rollback-to requires a migration name argument (e.g. --rollback-to 003_password_reset.js)')
    }
  }

  return { dryRun, statusOnly, rollback, rollbackToName }
}

// ─── Entrypoint ───────────────────────────────────────────────────────────────

async function main() {
  const rawArgs = process.argv.slice(2)
  let opts

  try {
    opts = parseArgs(rawArgs)
  } catch (e) {
    err(e.message)
    process.exit(1)
  }

  const { dryRun, statusOnly, rollback, rollbackToName } = opts

  log(`Environment: ${process.env.NODE_ENV ?? 'development'}`)
  log(`Database:    ${(process.env.DATABASE_URL ?? '').replace(/:\/\/.*@/, '://<credentials>@')}`)

  try {
    await ensureMigrationsTable()
    log(`Migrations table "${MIGRATIONS_TABLE}" ready.`)

    const migrations = discoverMigrations()
    log(`Discovered ${migrations.length} migration file(s).`)

    const applied = await getAppliedMigrations()
    log(`Already applied: ${applied.size}`)

    if (statusOnly) {
      await printStatus(migrations, applied)
      process.exit(0)
    }

    if (rollbackToName !== null) {
      await rollbackTo(migrations, rollbackToName, dryRun)
      process.exit(0)
    }

    if (rollback !== null) {
      await rollbackSteps(migrations, rollback, dryRun)
      process.exit(0)
    }

    await applyPending(migrations, applied, dryRun)
    process.exit(0)
  } catch (error) {
    err(error.message)
    if (error.stack) console.error(error.stack)
    process.exit(1)
  }
}

main()
