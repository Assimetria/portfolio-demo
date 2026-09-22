'use strict'
/**
 * Pre-migration integrity check.
 * If the core `users` table is missing but schema_migrations says migrations ran,
 * we have a "ghost migration" scenario (DB was reset but schema_migrations survived
 * in a subsequent fresh DB — this can't actually happen, but protects against
 * partial failures where schema_migrations was created then the container died
 * before 001_init completed).
 *
 * Action: drop schema_migrations so run.js re-applies everything from scratch.
 * All migrations use CREATE TABLE IF NOT EXISTS so this is safe.
 */

require('dotenv').config()

const db = require('../../../lib/@system/PostgreSQL')

async function main() {
  const ts = () => new Date().toISOString()
  try {
    // Check if users table exists
    const { exists } = await db.one(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
      ) AS exists`
    )

    if (!exists) {
      console.log(`[precheck][${ts()}] users table missing — resetting schema_migrations for full re-run`)
      await db.none('DROP TABLE IF EXISTS schema_migrations')
      console.log(`[precheck][${ts()}] schema_migrations dropped — migrations will re-run from scratch`)
    } else {
      console.log(`[precheck][${ts()}] users table present — skipping reset`)
    }

    process.exit(0)
  } catch (err) {
    console.error(`[precheck][${ts()}] ERROR: ${err.message}`)
    // Non-fatal: let run.js handle it
    process.exit(0)
  } finally {
    db.pgp.end()
  }
}

main()
