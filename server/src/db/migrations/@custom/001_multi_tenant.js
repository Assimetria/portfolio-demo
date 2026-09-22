'use strict'

/**
 * Multi-tenant support
 *   - tenants          — top-level tenant/organization records
 *   - tenant_members   — user ↔ tenant membership with role
 *
 * This layers on top of the @system users table and works alongside
 * the existing JWT + refresh-token session infrastructure. The
 * refresh-token rotation logic (migration 006) is tenant-agnostic;
 * tenant scope is resolved per-request via tenantContext middleware.
 */

exports.up = async (db) => {
  await db.none(`
    CREATE TABLE IF NOT EXISTS tenants (
      id            SERIAL PRIMARY KEY,
      slug          TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_tenants_owner_user_id ON tenants(owner_user_id);

    CREATE TABLE IF NOT EXISTS tenant_members (
      id         SERIAL PRIMARY KEY,
      tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role       TEXT NOT NULL DEFAULT 'member',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (tenant_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_tenant_members_user_id ON tenant_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant_id ON tenant_members(tenant_id);
  `)
  console.log('[001_multi_tenant] applied schema: tenants, tenant_members')
}

exports.down = async (db) => {
  await db.none('DROP TABLE IF EXISTS tenant_members CASCADE')
  await db.none('DROP TABLE IF EXISTS tenants CASCADE')
  console.log('[001_multi_tenant] rolled back tenants schema')
}
