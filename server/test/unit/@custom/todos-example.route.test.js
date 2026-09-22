'use strict'

// Route-level tests for the tenant-scoped todos example: every request runs
// inside withTenant() (set_config called with the resolved tenant), zod
// validation rejects bad input, and the repo receives parameterised SQL.

const request = require('supertest')
const express = require('express')

jest.mock('../../../src/lib/@system/PostgreSQL', () => {
  const t = {
    none: jest.fn(async () => undefined),
    any: jest.fn(),
    one: jest.fn(),
    oneOrNone: jest.fn(),
    result: jest.fn(),
  }
  return { _t: t, tx: jest.fn(async (fn) => fn(t)) }
})

jest.mock('../../../src/lib/@system/Helpers/auth', () => ({
  authenticate: (req, _res, next) => { req.user = { id: 7, role: 'user' }; next() },
  requireAdmin: (_req, res) => res.status(403).json({ message: 'nope' }),
  requireOwnerOrAdmin: () => (_req, _res, next) => next(),
  requirePlan: () => (_req, _res, next) => next(),
}))

jest.mock('../../../src/db/repos/@custom/TenantRepo', () => ({
  userIsMember: jest.fn(async () => ({ role: 'owner' })),
  findById: jest.fn(async (id) => ({ id, slug: 'acme' })),
  listForUser: jest.fn(async () => [{ id: 1, slug: 'default', role: 'owner' }]),
}))

const db = require('../../../src/lib/@system/PostgreSQL')
const router = require('../../../src/api/@custom/todos-example')

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use(router)
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ message: err.message }))
  return app
}

const TODO = { id: 3, tenant_id: 1, user_id: 7, title: 'Ship it', description: null, priority: 'high', completed: false }

beforeEach(() => jest.clearAllMocks())

describe('tenant scoping', () => {
  it('sets app.current_tenant_id for the default tenant on every request', async () => {
    db._t.any.mockResolvedValue([TODO])
    db._t.one.mockResolvedValue({ count: 1 })
    await request(buildApp()).get('/api/todos').expect(200)
    expect(db.tx).toHaveBeenCalledTimes(1)
    expect(db._t.none).toHaveBeenCalledWith('SELECT set_config($1, $2, true)', ['app.current_tenant_id', '1'])
  })

  it('honours X-Tenant-Id when the caller is a member', async () => {
    db._t.oneOrNone.mockResolvedValue(TODO)
    await request(buildApp()).get('/api/todos/3').set('X-Tenant-Id', '9').expect(200)
    expect(db._t.none).toHaveBeenCalledWith(expect.any(String), ['app.current_tenant_id', '9'])
  })
})

describe('GET /api/todos', () => {
  it('lists with pagination, whitelisted filters and parameterised search', async () => {
    db._t.any.mockResolvedValue([TODO])
    db._t.one.mockResolvedValue({ count: 1 })
    const res = await request(buildApp()).get('/api/todos?q=ship&priority=high&completed=false&sort=title&order=asc&limit=10&page=2').expect(200)
    expect(res.body.todos).toHaveLength(1)
    const [sql, params] = db._t.any.mock.calls[0]
    expect(sql).toMatch(/FROM todos WHERE \(LOWER\(title\) ILIKE \$1 OR LOWER\(description\) ILIKE \$2\) AND priority = \$3 AND completed = \$4 ORDER BY title ASC/)
    expect(sql).toMatch(/LIMIT \$5 OFFSET \$6/)
    expect(params).toEqual(['%ship%', '%ship%', 'high', false, 10, 10])
  })

  it('rejects unknown sort fields and bad enum values', async () => {
    const res = await request(buildApp()).get('/api/todos?sort=password&priority=urgent').expect(400)
    expect(res.body.message).toBe('Validation failed')
    expect(db.tx).not.toHaveBeenCalled()
  })
})

describe('POST /api/todos', () => {
  it('creates a todo attributed to the tenant and user', async () => {
    db._t.one.mockResolvedValue(TODO)
    const res = await request(buildApp()).post('/api/todos').send({ title: '  Ship it ', priority: 'high', tenant_id: 999, evil: 1 }).expect(201)
    expect(res.body.todo.id).toBe(3)
    const [sql, params] = db._t.one.mock.calls[0]
    expect(sql).toMatch(/INSERT INTO todos/)
    // tenant_id comes from the resolved tenant (1), never from the body (999)
    expect(params).toEqual([1, 7, 'Ship it', null, 'high'])
  })

  it('400s on a missing title', async () => {
    const res = await request(buildApp()).post('/api/todos').send({ description: 'x' }).expect(400)
    expect(res.body.errors[0].field).toBe('body.title')
    expect(db.tx).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/todos/:id', () => {
  it('updates whitelisted fields only', async () => {
    db._t.oneOrNone.mockResolvedValueOnce(TODO).mockResolvedValueOnce({ ...TODO, completed: true })
    const res = await request(buildApp()).patch('/api/todos/3').send({ completed: true, tenant_id: 5 }).expect(200)
    expect(res.body.todo.completed).toBe(true)
    const [sql, params] = db._t.oneOrNone.mock.calls[1]
    expect(sql).toMatch(/^UPDATE todos SET completed = \$1, updated_at = now\(\) WHERE id = \$2 RETURNING/)
    expect(params).toEqual([true, 3])
  })

  it('409s when retitling a completed todo', async () => {
    db._t.oneOrNone.mockResolvedValueOnce({ ...TODO, completed: true })
    await request(buildApp()).patch('/api/todos/3').send({ title: 'New' }).expect(409)
  })

  it('400s on an empty body or non-numeric id', async () => {
    await request(buildApp()).patch('/api/todos/3').send({}).expect(400)
    await request(buildApp()).patch('/api/todos/abc').send({ title: 'x' }).expect(400)
  })

  it('404s when the row is invisible to this tenant', async () => {
    db._t.oneOrNone.mockResolvedValueOnce(null)
    await request(buildApp()).patch('/api/todos/3').send({ title: 'x' }).expect(404)
  })
})

describe('DELETE /api/todos/:id', () => {
  it('deletes an existing todo', async () => {
    db._t.oneOrNone.mockResolvedValueOnce(TODO)
    db._t.result.mockResolvedValue({ rowCount: 1 })
    const res = await request(buildApp()).delete('/api/todos/3').expect(200)
    expect(res.body.message).toMatch(/deleted/i)
    expect(db._t.result).toHaveBeenCalledWith('DELETE FROM todos WHERE id = $1', [3])
  })

  it('400s on a non-numeric id', async () => {
    await request(buildApp()).delete('/api/todos/x').expect(400)
    expect(db.tx).not.toHaveBeenCalled()
  })
})
