'use strict'

// Unit tests for @custom tenantContext: withTenant() transaction scoping,
// bindRepo(), and the middleware wiring (req.tenant / req.withTenant).

jest.mock('../../../src/lib/@system/PostgreSQL', () => {
  const t = { none: jest.fn(async () => undefined), any: jest.fn(), one: jest.fn(), oneOrNone: jest.fn(), result: jest.fn() }
  const db = { _t: t, tx: jest.fn(async (fn) => fn(t)) }
  return db
})

jest.mock('../../../src/db/repos/@custom/TenantRepo', () => ({
  userIsMember: jest.fn(),
  findById: jest.fn(),
  listForUser: jest.fn(),
}))

const db = require('../../../src/lib/@system/PostgreSQL')
const TenantRepo = require('../../../src/db/repos/@custom/TenantRepo')
const { withTenant, bindRepo, tenantContext, requireTenantRole, TENANT_SETTING } = require('../../../src/lib/@custom/tenantContext')

beforeEach(() => jest.clearAllMocks())

describe('withTenant', () => {
  it('runs fn inside a transaction after setting the tenant GUC locally', async () => {
    const fn = jest.fn(async (t) => t === db._t ? 'ok' : 'wrong-tx')
    const out = await withTenant(42, fn)
    expect(out).toBe('ok')
    expect(db.tx).toHaveBeenCalledTimes(1)
    expect(db._t.none).toHaveBeenCalledWith('SELECT set_config($1, $2, true)', [TENANT_SETTING, '42'])
    // set_config must run before the callback
    expect(db._t.none.mock.invocationCallOrder[0]).toBeLessThan(fn.mock.invocationCallOrder[0])
  })

  it('accepts numeric strings', async () => {
    await withTenant('7', async () => null)
    expect(db._t.none).toHaveBeenCalledWith(expect.any(String), [TENANT_SETTING, '7'])
  })

  it('rejects invalid tenant ids without touching the db', async () => {
    for (const bad of [0, -1, 1.5, 'abc', null, undefined, '1; DROP TABLE x']) {
      await expect(withTenant(bad, async () => null)).rejects.toThrow(/positive integer/)
    }
    expect(db.tx).not.toHaveBeenCalled()
  })

  it('rejects a non-function callback', async () => {
    await expect(withTenant(1, 'nope')).rejects.toThrow(/fn must be a function/)
  })

  it('propagates errors thrown by fn (transaction rolls back)', async () => {
    await expect(withTenant(1, async () => { throw new Error('boom') })).rejects.toThrow('boom')
  })

  it('uses an injected connection when provided', async () => {
    const t2 = { none: jest.fn() }
    const conn = { tx: jest.fn(async (fn) => fn(t2)) }
    await withTenant(3, async () => 1, { db: conn })
    expect(conn.tx).toHaveBeenCalled()
    expect(t2.none).toHaveBeenCalledWith(expect.any(String), [TENANT_SETTING, '3'])
    expect(db.tx).not.toHaveBeenCalled()
  })
})

describe('bindRepo', () => {
  it('prepends the transaction to every static method', async () => {
    class Repo {
      static async findById(t, id) { return { t, id } }
      static async create(t, data) { return { t, data } }
    }
    const t = { tag: 'tx' }
    const bound = bindRepo(Repo, t)
    expect(await bound.findById(5)).toEqual({ t, id: 5 })
    expect(await bound.create({ a: 1 })).toEqual({ t, data: { a: 1 } })
    expect(Object.keys(bound).sort()).toEqual(['create', 'findById'])
  })
})

describe('tenantContext middleware', () => {
  function mockRes() {
    const res = {}
    res.status = jest.fn().mockReturnValue(res)
    res.json = jest.fn().mockReturnValue(res)
    return res
  }
  function mockReq({ user = { id: 7 }, header, query = {} } = {}) {
    return { user, query, get: (name) => (name === 'X-Tenant-Id' ? header : undefined) }
  }

  it('401s when unauthenticated', async () => {
    const res = mockRes()
    await tenantContext(mockReq({ user: null }), res, jest.fn())
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('400s on a malformed X-Tenant-Id', async () => {
    const res = mockRes()
    const next = jest.fn()
    await tenantContext(mockReq({ header: 'abc' }), res, next)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(next).not.toHaveBeenCalled()
    expect(TenantRepo.userIsMember).not.toHaveBeenCalled()
  })

  it('403s when the user is not a member of the requested tenant', async () => {
    TenantRepo.userIsMember.mockResolvedValue(null)
    const res = mockRes()
    await tenantContext(mockReq({ header: '9' }), res, jest.fn())
    expect(TenantRepo.userIsMember).toHaveBeenCalledWith(9, 7)
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('resolves the requested tenant and exposes req.withTenant', async () => {
    TenantRepo.userIsMember.mockResolvedValue({ role: 'admin' })
    TenantRepo.findById.mockResolvedValue({ id: 9, slug: 'acme' })
    const req = mockReq({ header: '9' })
    const next = jest.fn()
    await tenantContext(req, mockRes(), next)
    expect(next).toHaveBeenCalledWith()
    expect(req.tenant).toEqual({ id: 9, slug: 'acme' })
    expect(req.tenantRole).toBe('admin')
    expect(typeof req.withTenant).toBe('function')

    await req.withTenant(async () => 'x')
    expect(db._t.none).toHaveBeenCalledWith(expect.any(String), [TENANT_SETTING, '9'])
  })

  it('falls back to the first tenant when none is requested', async () => {
    TenantRepo.listForUser.mockResolvedValue([{ id: 2, role: 'member' }, { id: 3, role: 'owner' }])
    const req = mockReq()
    const next = jest.fn()
    await tenantContext(req, mockRes(), next)
    expect(req.tenant.id).toBe(2)
    expect(req.tenantRole).toBe('member')
    expect(next).toHaveBeenCalled()
  })

  it('400s when the user has no tenants at all', async () => {
    TenantRepo.listForUser.mockResolvedValue([])
    const res = mockRes()
    await tenantContext(mockReq(), res, jest.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('requireTenantRole gates on the resolved role', () => {
    const res = mockRes()
    const next = jest.fn()
    requireTenantRole('owner', 'admin')({ tenantRole: 'member' }, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    requireTenantRole('owner', 'admin')({ tenantRole: 'owner' }, mockRes(), next)
    expect(next).toHaveBeenCalledTimes(1)
  })
})
