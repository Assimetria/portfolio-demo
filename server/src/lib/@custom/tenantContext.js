'use strict'

// @custom — tenant scoping for multi-tenant products
//
//   tenantContext      — resolves req.tenant / req.tenantRole for the caller
//                        and exposes req.withTenant(fn) for RLS-scoped queries
//   requireTenantRole  — role gate inside the resolved tenant
//   withTenant         — run `fn(t)` in a transaction with
//                        `app.current_tenant_id` set (SET LOCAL semantics) so
//                        Postgres row-level-security policies (see migration
//                        @custom/003_tenant_rls.js) filter every statement.
//
// Pattern for tenant-scoped tables:
//   router.get('/api/todos', authenticate, tenantContext, (req, res, next) =>
//     req.withTenant((t) => TodoRepo.list(t, req.tenant.id)).then(...)

const db = require('../@system/PostgreSQL')
const TenantRepo = require('../../db/repos/@custom/TenantRepo')

/** GUC name read by the RLS policies. Keep in sync with the migration. */
const TENANT_SETTING = 'app.current_tenant_id'

function toTenantId(value) {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

/**
 * Run `fn(t)` inside a transaction whose connection has
 * `app.current_tenant_id` set for the duration of the transaction only
 * (`set_config(..., is_local = true)` ≡ `SET LOCAL`, but parameterisable).
 *
 * @template T
 * @param {number|string} tenantId
 * @param {(t: import('pg-promise').ITask<{}>) => Promise<T>} fn
 * @param {{ db?: object }} [opts] — inject a db/tx object (tests)
 * @returns {Promise<T>}
 */
async function withTenant(tenantId, fn, { db: conn = db } = {}) {
  const id = toTenantId(tenantId)
  if (id === null) throw new TypeError(`withTenant: tenantId must be a positive integer (got ${JSON.stringify(tenantId)})`)
  if (typeof fn !== 'function') throw new TypeError('withTenant: fn must be a function')

  return conn.tx(async (t) => {
    await t.none('SELECT set_config($1, $2, true)', [TENANT_SETTING, String(id)])
    return fn(t)
  })
}

/**
 * Resolves the current tenant scope for an authenticated request.
 *
 * Runs AFTER the @system `authenticate` middleware. Reads the tenant id
 * from the `X-Tenant-Id` header (falling back to `?tenant=` query param),
 * verifies the authenticated user is a member, and attaches:
 *   - req.tenant      — the tenant row
 *   - req.tenantRole  — the user's role within the tenant
 *   - req.withTenant  — (fn) => withTenant(req.tenant.id, fn)
 *
 * If no tenant id is provided, we resolve the user's first tenant to
 * keep single-tenant flows working transparently.
 */
async function tenantContext(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const raw = req.get('X-Tenant-Id') || req.query.tenant
    if (raw !== undefined && raw !== null && raw !== '' && toTenantId(raw) === null) {
      return res.status(400).json({ error: 'Invalid tenant id' })
    }
    const tenantId = raw ? toTenantId(raw) : null

    if (tenantId) {
      const membership = await TenantRepo.userIsMember(tenantId, req.user.id)
      if (!membership) {
        return res.status(403).json({ error: 'Not a member of this tenant' })
      }
      req.tenant = await TenantRepo.findById(tenantId)
      req.tenantRole = membership.role
    } else {
      const tenants = await TenantRepo.listForUser(req.user.id)
      if (tenants.length === 0) {
        return res.status(400).json({ error: 'No tenant selected' })
      }
      req.tenant = tenants[0]
      req.tenantRole = tenants[0].role
    }

    req.withTenant = (fn) => withTenant(req.tenant.id, fn)
    return next()
  } catch (err) {
    return next(err)
  }
}

/**
 * Bind a repository whose static methods take the transaction as their first
 * argument (`Repo.findById(t, id)`) to a specific `t`, producing the plain
 * `{ findAll, findById, create, update, delete, count }` shape the @system
 * CRUD helpers (handleList/handleCreate/…) expect.
 *
 *   await req.withTenant((t) => handleCreate({ repo: bindRepo(TodoRepo, t), req, res, next }))
 */
function bindRepo(Repo, t) {
  const bound = {}
  for (const name of Object.getOwnPropertyNames(Repo)) {
    if (typeof Repo[name] === 'function' && !['length', 'name', 'prototype'].includes(name)) {
      bound[name] = (...args) => Repo[name](t, ...args)
    }
  }
  return bound
}

function requireTenantRole(...allowed) {
  return (req, res, next) => {
    if (!req.tenantRole || !allowed.includes(req.tenantRole)) {
      return res.status(403).json({ error: 'Insufficient tenant role' })
    }
    return next()
  }
}

module.exports = { tenantContext, requireTenantRole, withTenant, bindRepo, TENANT_SETTING }
