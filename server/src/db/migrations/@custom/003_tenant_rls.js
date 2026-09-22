'use strict'

/**
 * @custom — Row-Level Security for tenant-scoped example data
 *
 * Creates the `todos` example table (tenant-scoped) and enables Postgres RLS
 * on it. Every statement against the table is filtered by the policy
 *
 *     tenant_id = current_setting('app.current_tenant_id', true)::int
 *
 * The setting is populated per-transaction by `withTenant()` in
 * server/src/lib/@custom/tenantContext.js. With no setting present the
 * comparison is NULL → no rows are visible or writable, which is the safe
 * default (a query that forgot tenant scoping returns nothing instead of
 * everything).
 *
 * FORCE ROW LEVEL SECURITY makes the policy apply to the table owner too —
 * the app usually connects as the owner, so without FORCE the policy would be
 * silently bypassed. Superusers still bypass RLS (Postgres semantics); do not
 * run the app as a superuser.
 *
 * Idempotent: safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).
 *
 * To scope another table the same way, copy the block below and replace
 * `todos` — the policy body stays identical.
 */

const TENANT_SETTING = 'app.current_tenant_id'

/** Build the idempotent RLS statements for a tenant-scoped table. */
function rlsStatements(table) {
  return `
    ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
    ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS ${table}_tenant_isolation ON ${table};
    CREATE POLICY ${table}_tenant_isolation ON ${table}
      USING      (tenant_id = NULLIF(current_setting('${TENANT_SETTING}', true), '')::int)
      WITH CHECK (tenant_id = NULLIF(current_setting('${TENANT_SETTING}', true), '')::int);
  `
}

exports.up = async (db) => {
  await db.none(`
    CREATE TABLE IF NOT EXISTS todos (
      id          SERIAL PRIMARY KEY,
      tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
      title       TEXT NOT NULL,
      description TEXT,
      priority    TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
      completed   BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Older installs may already have a todos table without tenant scoping.
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_todos_tenant_id ON todos(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_todos_tenant_completed ON todos(tenant_id, completed);
  `)

  await db.none(rlsStatements('todos'))

  console.log('[003_tenant_rls] applied: todos table + row-level security policy')
}

exports.down = async (db) => {
  await db.none(`
    DROP POLICY IF EXISTS todos_tenant_isolation ON todos;
    ALTER TABLE IF EXISTS todos NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS todos DISABLE ROW LEVEL SECURITY;
  `)
  console.log('[003_tenant_rls] rolled back: RLS disabled on todos (table kept)')
}

exports.rlsStatements = rlsStatements
exports.TENANT_SETTING = TENANT_SETTING
