/**
 * Integration tests for PostgreSQL connection health.
 *
 * Verifies that the PG pool can connect, execute queries, handle
 * concurrent connections, and survive idle periods (keepAlive).
 *
 * Requires DATABASE_URL pointing at a real Postgres instance.
 * Skipped gracefully when no DB is available.
 */

const hasDb = Boolean(process.env.DATABASE_URL)
const describeIf = hasDb ? describe : describe.skip

let db
if (hasDb) {
  db = require('../../src/lib/@system/PostgreSQL')
}

describeIf('PostgreSQL pool health (real DB)', () => {
  afterAll(async () => {
    // Return connections to the pool — do NOT call disconnectPool() here
    // because other test files may still need the shared pool.
  })

  it('connects and executes SELECT 1', async () => {
    const result = await db.one('SELECT 1 AS ok')
    expect(result.ok).toBe(1)
  })

  it('returns current timestamp from DB', async () => {
    const result = await db.one('SELECT now() AS ts')
    expect(new Date(result.ts).getTime()).toBeGreaterThan(0)
  })

  it('handles concurrent queries (10 in parallel)', async () => {
    const queries = Array.from({ length: 10 }, (_, i) =>
      db.one('SELECT $1::int AS n', [i])
    )
    const results = await Promise.all(queries)
    results.forEach((r, i) => {
      expect(r.n).toBe(i)
    })
  })

  it('pool survives a short idle period', async () => {
    // Execute a query, wait 2s (simulating idle), then query again.
    await db.one('SELECT 1')
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const result = await db.one('SELECT 1 AS alive')
    expect(result.alive).toBe(1)
  }, 10000) // 10s timeout for this test

  it('rejects invalid SQL gracefully', async () => {
    await expect(db.none('SELECTT invalid_syntax')).rejects.toThrow()
  })

  it('reports pool configuration', () => {
    // Verify the pool is configured (not null/undefined)
    expect(db.$pool).toBeDefined()
    expect(db.$pool.options).toBeDefined()
  })
})
