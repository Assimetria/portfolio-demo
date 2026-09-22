'use strict'

// Unit tests for the @custom RLS migration: idempotent statements, correct
// policy expression, and a working down().

const migration = require('../../../src/db/migrations/@custom/003_tenant_rls.js')

function mockDb() {
  const calls = []
  return { calls, none: jest.fn(async (sql) => { calls.push(sql) }) }
}

describe('003_tenant_rls.up', () => {
  it('creates the todos table idempotently with a tenant_id FK', async () => {
    const db = mockDb()
    await migration.up(db)
    const all = db.calls.join('\n')
    expect(all).toMatch(/CREATE TABLE IF NOT EXISTS todos/)
    expect(all).toMatch(/tenant_id\s+INTEGER NOT NULL REFERENCES tenants\(id\) ON DELETE CASCADE/)
    expect(all).toMatch(/ADD COLUMN IF NOT EXISTS tenant_id/)
    expect(all).toMatch(/CREATE INDEX IF NOT EXISTS idx_todos_tenant_id/)
  })

  it('enables + forces RLS and (re)creates the tenant policy idempotently', async () => {
    const db = mockDb()
    await migration.up(db)
    const all = db.calls.join('\n')
    expect(all).toMatch(/ALTER TABLE todos ENABLE ROW LEVEL SECURITY/)
    expect(all).toMatch(/ALTER TABLE todos FORCE ROW LEVEL SECURITY/)
    expect(all).toMatch(/DROP POLICY IF EXISTS todos_tenant_isolation ON todos/)
    expect(all).toMatch(/CREATE POLICY todos_tenant_isolation ON todos/)
    // USING and WITH CHECK both bound to the GUC read with missing_ok = true
    const policy = /tenant_id = NULLIF\(current_setting\('app\.current_tenant_id', true\), ''\)::int/g
    expect(all.match(policy)).toHaveLength(2)
  })

  it('never uses non-idempotent DDL', async () => {
    const db = mockDb()
    await migration.up(db)
    const all = db.calls.join('\n')
    expect(all).not.toMatch(/CREATE TABLE todos\b/)
    // every CREATE POLICY is preceded by a matching DROP POLICY IF EXISTS
    const creates = (all.match(/CREATE POLICY/g) || []).length
    const drops = (all.match(/DROP POLICY IF EXISTS/g) || []).length
    expect(creates).toBeGreaterThan(0)
    expect(drops).toBe(creates)
    expect(all).not.toMatch(/DROP TABLE/)
  })

  it('rlsStatements() is reusable for other tables', () => {
    const sql = migration.rlsStatements('invoices')
    expect(sql).toMatch(/ALTER TABLE invoices ENABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/CREATE POLICY invoices_tenant_isolation ON invoices/)
    expect(migration.TENANT_SETTING).toBe('app.current_tenant_id')
  })

  it('shares the GUC name with tenantContext.withTenant', () => {
    jest.doMock('../../../src/lib/@system/PostgreSQL', () => ({ tx: jest.fn() }))
    jest.doMock('../../../src/db/repos/@custom/TenantRepo', () => ({}))
    const { TENANT_SETTING } = require('../../../src/lib/@custom/tenantContext')
    expect(TENANT_SETTING).toBe(migration.TENANT_SETTING)
  })
})

describe('003_tenant_rls.down', () => {
  it('drops the policy and disables RLS without dropping data', async () => {
    const db = mockDb()
    await migration.down(db)
    const all = db.calls.join('\n')
    expect(all).toMatch(/DROP POLICY IF EXISTS todos_tenant_isolation/)
    expect(all).toMatch(/DISABLE ROW LEVEL SECURITY/)
    expect(all).not.toMatch(/DROP TABLE/)
  })
})
