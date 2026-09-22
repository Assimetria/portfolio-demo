/**
 * API tests for GET /api/data-table/imports (@custom)
 *
 * Tests server-side sorting, pagination, filtering, and the sorted response
 * structure. Uses mocked authentication and an in-memory data store.
 */

const request = require('supertest')
const crypto = require('crypto')

// ── Mock PostgreSQL ────────────────────────────────────────────────────────
jest.mock('../../../src/lib/@system/PostgreSQL', () => {
  const mockDb = {
    _reset() {},
    one: jest.fn(),
    oneOrNone: jest.fn(),
    none: jest.fn(),
    any: jest.fn(),
    tx: jest.fn(async (fn) => fn(mockDb)),
  }
  return mockDb
})

// ── Mock Redis ─────────────────────────────────────────────────────────────
jest.mock('../../../src/lib/@system/Redis', () => ({
  client: {
    get: jest.fn(async () => null),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(async () => 0),
    incr: jest.fn(async () => 1),
    expire: jest.fn(),
    ttl: jest.fn(async () => -1),
    ping: jest.fn(async () => 'PONG'),
  },
  isReady: jest.fn(() => true),
}))

// ── Mock UserRepo so JWT auth can find the user ────────────────────────────
jest.mock('../../../src/db/repos/@system/UserRepo', () => ({
  findById: jest.fn(async () => ({
    id: 1,
    email: 'admin@test.com',
    name: 'Test Admin',
    role: 'admin',
    plan: 'pro',
  })),
}))

// Set up JWT keys BEFORE requiring the app
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})
process.env.JWT_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n')
process.env.JWT_PUBLIC_KEY = publicKey.replace(/\n/g, '\\n')

const app = require('../../../src/app')
const db = require('../../../src/lib/@system/PostgreSQL')

beforeEach(() => {
  jest.clearAllMocks()
  db.one.mockResolvedValue({ '?column?': 1 })
  const UserRepo = require('../../../src/db/repos/@system/UserRepo')
  UserRepo.findById.mockResolvedValue({
    id: 1,
    email: 'admin@test.com',
    name: 'Test Admin',
    role: 'admin',
    plan: 'pro',
  })
})

let token
beforeAll(async () => {
  const jwt = require('jsonwebtoken')
  token = jwt.sign(
    { sub: 1, role: 'admin', plan: 'pro' },
    { key: privateKey, passphrase: '' },
    { algorithm: 'RS256', expiresIn: '1h' }
  )
})
describe('GET /api/data-table/imports', () => {
  // ── Auth ─────────────────────────────────────────────────────────────────
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/data-table/imports')
    expect(res.status).toBe(401)
  })

  it('returns 401 with an invalid bearer token', async () => {
    const res = await request(app)
      .get('/api/data-table/imports')
      .set('Authorization', 'Bearer invalid.token.here')
    expect(res.status).toBe(401)
  })

  // ── Response structure ───────────────────────────────────────────────────
  it('returns the expected JSON envelope', async () => {
    const res = await request(app)
      .get('/api/data-table/imports')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toBeDefined()
    expect(res.body.data.imports).toBeInstanceOf(Array)
    expect(res.body.data.pagination).toBeDefined()
  })

  it('pagination object has correct fields', async () => {
    const res = await request(app)
      .get('/api/data-table/imports')
      .set('Authorization', `Bearer ${token}`)

    const { pagination } = res.body.data
    expect(pagination).toHaveProperty('page')
    expect(pagination).toHaveProperty('pageSize')
    expect(pagination).toHaveProperty('total')
    expect(pagination).toHaveProperty('totalPages')
    expect(pagination.page).toBe(1)
    expect(pagination.pageSize).toBe(10)
    expect(pagination.total).toBe(25)
    expect(pagination.totalPages).toBe(3)
  })
// ── Sorting ──────────────────────────────────────────────────────────────
  it('sorts ascending by default (by id)', async () => {
    const res = await request(app)
      .get('/api/data-table/imports')
      .set('Authorization', `Bearer ${token}`)

    const ids = res.body.data.imports.map((r) => r.id)
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]).toBeGreaterThan(ids[i - 1])
    }
  })

  it('sorts descending when direction=desc', async () => {
    const res = await request(app)
      .get('/api/data-table/imports?direction=desc')
      .set('Authorization', `Bearer ${token}`)

    const ids = res.body.data.imports.map((r) => r.id)
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]).toBeLessThan(ids[i - 1])
    }
  })

  it('sorts by a string column (source)', async () => {
    const res = await request(app)
      .get('/api/data-table/imports?sort=source&direction=asc')
      .set('Authorization', `Bearer ${token}`)

    const values = res.body.data.imports.map((r) => r.source)
    for (let i = 1; i < values.length; i++) {
      expect(values[i].localeCompare(values[i - 1])).toBeGreaterThanOrEqual(0)
    }
  })

  it('sorts by a string column descending', async () => {
    const res = await request(app)
      .get('/api/data-table/imports?sort=source&direction=desc')
      .set('Authorization', `Bearer ${token}`)

    const values = res.body.data.imports.map((r) => r.source)
    for (let i = 1; i < values.length; i++) {
      expect(values[i].localeCompare(values[i - 1])).toBeLessThanOrEqual(0)
    }
  })

  it('sorts by status field', async () => {
    const res = await request(app)
      .get('/api/data-table/imports?sort=status&direction=asc')
      .set('Authorization', `Bearer ${token}`)

    const values = res.body.data.imports.map((r) => r.status)
    for (let i = 1; i < values.length; i++) {
      expect(values[i].localeCompare(values[i - 1])).toBeGreaterThanOrEqual(0)
    }
  })

  it('sorts by records (numeric field)', async () => {
    const res = await request(app)
      .get('/api/data-table/imports?sort=records&direction=asc')
      .set('Authorization', `Bearer ${token}`)

    const values = res.body.data.imports.map((r) => r.records)
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1])
    }
  })

  // ── Pagination ───────────────────────────────────────────────────────────
  it('respects pageSize parameter', async () => {
    const res = await request(app)
      .get('/api/data-table/imports?pageSize=5')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body.data.imports).toHaveLength(5)
    expect(res.body.data.pagination.pageSize).toBe(5)
    expect(res.body.data.pagination.totalPages).toBe(5)
  })

  it('returns correct page of data', async () => {
    const res1 = await request(app)
      .get('/api/data-table/imports?page=1&pageSize=5')
      .set('Authorization', `Bearer ${token}`)

    const res2 = await request(app)
      .get('/api/data-table/imports?page=2&pageSize=5')
      .set('Authorization', `Bearer ${token}`)

    expect(res1.body.data.imports).toHaveLength(5)
    expect(res2.body.data.imports).toHaveLength(5)
    const ids1 = res1.body.data.imports.map((r) => r.id)
    const ids2 = res2.body.data.imports.map((r) => r.id)
    const overlap = ids1.some((id) => ids2.includes(id))
    expect(overlap).toBe(false)
  })

  it('handles page beyond last page gracefully', async () => {
    const res = await request(app)
      .get('/api/data-table/imports?page=999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.data.imports).toHaveLength(0)
  })

  // ── Search / Filtering ───────────────────────────────────────────────────
  it('filters results when search query is provided', async () => {
    const res = await request(app)
      .get('/api/data-table/imports?search=import+1')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.data.imports.length).toBeGreaterThan(0)
    expect(res.body.data.pagination.total).toBeLessThan(25)
    for (const item of res.body.data.imports) {
      const match = Object.values(item).some((val) =>
        String(val).toLowerCase().includes('import 1')
      )
      expect(match).toBe(true)
    }
  })

  it('returns empty results for non-matching search', async () => {
    const res = await request(app)
      .get('/api/data-table/imports?search=nonexistentvalue123')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.data.imports).toHaveLength(0)
    expect(res.body.data.pagination.total).toBe(0)
  })

  // ── Edge cases ──────────────────────────────────────────────────────────
  it('clamps pageSize to max 100', async () => {
    const res = await request(app)
      .get('/api/data-table/imports?pageSize=999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body.data.pagination.pageSize).toBe(100)
  })

  it('defaults invalid page to 1', async () => {
    const res = await request(app)
      .get('/api/data-table/imports?page=-5')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.data.pagination.page).toBe(1)
  })

  it('each import row has required fields', async () => {
    const res = await request(app)
      .get('/api/data-table/imports')
      .set('Authorization', `Bearer ${token}`)

    for (const row of res.body.data.imports) {
      expect(row).toHaveProperty('id')
      expect(row).toHaveProperty('name')
      expect(row).toHaveProperty('source')
      expect(row).toHaveProperty('status')
      expect(row).toHaveProperty('records')
      expect(row).toHaveProperty('created_at')
      expect(typeof row.id).toBe('number')
      expect(typeof row.name).toBe('string')
    }
  })
})