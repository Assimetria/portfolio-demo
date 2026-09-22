'use strict'

/**
 * @file 002_user_fields_subscription_attribution — migration + schema parity tests
 *
 * Covers the @custom migration that adds profile fields and the owning
 * subscription pointer to the @system `users` table (Task #1024404). Because
 * migrations run against a live Postgres in production, these are unit tests
 * over a captured `db.none` stub plus a parity check against the canonical
 * `users.sql` schema (the idempotency/backfill semantics the migration encodes).
 */

const path = require('path')

const migration = require('../../../src/db/migrations/@custom/002_user_fields_subscription_attribution')
const usersSql = path.resolve(
  __dirname,
  '../../../src/db/schemas/@system/users.sql'
)

/** Collects the SQL strings handed to db.none and resolves successfully. */
function stubDb() {
  const calls = []
  return {
    calls,
    async none(query) {
      calls.push(query)
    },
  }
}

describe('002_user_fields_subscription_attribution migration', () => {
  it('exports idempotent up/down migration functions', () => {
    expect(typeof migration.up).toBe('function')
    expect(typeof migration.down).toBe('function')
  })

  describe('up', () => {
    it('adds all profile columns and the owning subscription FK', async () => {
      const db = stubDb()
      await migration.up(db)

      const alter = db.calls.find((q) => q.includes('ALTER TABLE users'))
      expect(alter).toBeDefined()
      ;[
        'avatar_url',
        'display_name',
        'locale',
        'timezone',
        'phone',
        'marketing_opt_in',
        'last_seen_at',
        'subscription_id',
      ].forEach((col) => {
        expect(alter).toMatch(new RegExp(`ADD COLUMN IF NOT EXISTS ${col}\\b`))
      })
      // The pointer must target subscriptions with ON DELETE SET NULL
      expect(alter).toContain('REFERENCES subscriptions(id) ON DELETE SET NULL')
    })

    it('creates the owning-subscription index', async () => {
      const db = stubDb()
      await migration.up(db)

      expect(
        db.calls.some((q) => q.includes('CREATE INDEX IF NOT EXISTS idx_users_subscription_id ON users(subscription_id)'))
      ).toBe(true)
    })

    it('backfills each user with their latest active/trialing subscription', async () => {
      const db = stubDb()
      await migration.up(db)

      const backfill = db.calls.find((q) =>
        /UPDATE users\s+u\s+SET\s+subscription_id\s*=\s*o\.subscription_id/.test(q)
      )
      expect(backfill).toBeDefined()
      // Only owning (active/trialing) subscriptions may be assigned
      expect(backfill).toMatch(/status IN \('active', 'trialing'\)/)
      // Latest per-user wins via DISTINCT ON ordered by current_period_end
      expect(backfill).toContain('DISTINCT ON (s.user_id)')
      expect(backfill).toContain('ORDER BY s.user_id')
      expect(backfill).toContain('current_period_end DESC')
    })

    it('is idempotent (uses IF NOT EXISTS guards)', async () => {
      const db = stubDb()
      await migration.up(db)

      const alter = db.calls.find((q) => q.includes('ALTER TABLE users'))
      const index = db.calls.find((q) => q.includes('CREATE INDEX'))
      expect(alter).toContain('ADD COLUMN IF NOT EXISTS')
      expect(index).toContain('CREATE INDEX IF NOT EXISTS')
    })

    it('runs in a stable order: alter -> index -> backfill', async () => {
      const db = stubDb()
      await migration.up(db)

      const positions = db.calls.map((q) =>
        q.includes('ALTER TABLE users')
          ? 'alter'
          : q.includes('CREATE INDEX')
            ? 'index'
            : /UPDATE users\s+u\s+SET\s+subscription_id\s*=\s*o\.subscription_id/.test(q)
              ? 'backfill'
              : null
      )
      expect(positions.filter(Boolean)).toEqual(['alter', 'index', 'backfill'])
    })
  })

  describe('down', () => {
    it('drops the index and all added columns with IF EXISTS guards', async () => {
      const db = stubDb()
      await migration.down(db)

      expect(
        db.calls.some((q) => q.includes('DROP INDEX IF EXISTS idx_users_subscription_id'))
      ).toBe(true)

      const alter = db.calls.find((q) => q.includes('ALTER TABLE users'))
      expect(alter).toBeDefined()
      expect(alter).toContain('DROP COLUMN IF EXISTS')
      ;[
        'subscription_id',
        'last_seen_at',
        'marketing_opt_in',
        'phone',
        'timezone',
        'locale',
        'display_name',
        'avatar_url',
      ].forEach((col) => {
        expect(alter).toMatch(new RegExp(`DROP COLUMN IF EXISTS ${col}\\b`))
      })
      // Every statement in down uses IF EXISTS so a duplicate rollback is a no-op
      db.calls.forEach((q) => {
        expect(q).not.toMatch(/DROP (INDEX|COLUMN)(?! IF EXISTS)/)
      })
    })
  })
})

describe('002 migration <-> users.sql schema parity', () => {
  it('profile columns in the migration are mirrored by canonical users.sql', async () => {
    const db = stubDb()
    await migration.up(db)
    const migrateAdds = db.calls.find((q) => q.includes('ALTER TABLE users'))

    const fs = jest.requireActual('fs')
    const canonical = fs.readFileSync(usersSql, 'utf8')

    // New scalar profile fields appear in BOTH the migration DDL and users.sql.
    const profileCols = [
      'avatar_url',
      'display_name',
      'locale',
      'timezone',
      'phone',
      'marketing_opt_in',
      'last_seen_at',
    ]
    profileCols.forEach((col) => {
      expect(migrateAdds).toContain(`ADD COLUMN IF NOT EXISTS ${col}`)
      expect(canonical).toMatch(new RegExp(`\\b${col}\\b`))
    })
  })

  it('keeps users.sql boot-safe: the subscription FK lives only in migration 002', async () => {
    const db = stubDb()
    await migration.up(db)
    const migrateAdds = db.calls.find((q) => q.includes('ALTER TABLE users'))

    const fs = jest.requireActual('fs')
    const canonical = fs.readFileSync(usersSql, 'utf8')

    // The owning-subscription back-pointer is added by the @custom migration
    // (which runs after the @system 001_init applied users BEFORE subscriptions).
    // Mirroring the subscriptions.sql/brand_id precedent, the base users.sql must
    // NOT inline a REFERENCES subscriptions FK that would break a clean-install
    // 001_init on an empty database.
    expect(migrateAdds).toContain('subscription_id')
    expect(migrateAdds).toContain('REFERENCES subscriptions(id) ON DELETE SET NULL')
    expect(
      db.calls.some((q) => q.includes('CREATE INDEX IF NOT EXISTS idx_users_subscription_id'))
    ).toBe(true)

    expect(canonical).not.toContain('REFERENCES subscriptions(id)')
    expect(canonical).toContain('002_user_fields_subscription_attribution')
  })
})
