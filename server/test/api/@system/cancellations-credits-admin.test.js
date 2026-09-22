/**
 * API tests for the admin cancellations dashboard & basic credits system.
 *
 * These routes live on @system admin under:
 *   GET  /api/admin/churn
 *   GET  /api/admin/credits
 *   GET  /api/admin/credits/:userId
 *   POST /api/admin/credits/:userId/adjust
 *
 * Contract under test: admin gating (authenticate + requireAdmin), request
 * validation and response shapes. External services (DB, Redis, Email) are
 * mocked so the tests are deterministic and CI-safe.
 */

const request = require('supertest')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})
process.env.JWT_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n')
process.env.JWT_PUBLIC_KEY = publicKey.replace(/\n/g, '\\n')

jest.mock('../../../src/lib/@system/PostgreSQL', () => {
  const mockDb = {
    _reset() {
      for (const m of ['one', 'oneOrNone', 'none', 'any']) {
        mockDb[m].mockReset()
      }
    },
    one: jest.fn(),
    oneOrNone: jest.fn(),
    none: jest.fn(),
    any: jest.fn(),
    task: jest.fn(async (fn) => fn(mockDb)),
    tx: jest.fn(async (fn) => fn(mockDb)),
  }
  return mockDb
})

jest.mock('../../../src/lib/@system/Redis', () => ({
  client: {
    get: jest.fn(async () => null),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(async () => 0),
    incr: jest.fn(async () => 1),
    expire: jest.fn(),
    ttl: jest.fn(async () => -1),
  },
  isReady: () => false,
}))

jest.mock('../../../src/lib/@system/Email', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}))

const app = require('../../../src/app')
const db = require('../../../src/lib/@system/PostgreSQL')


const USER = {
  id: 'dash-user-01',
  email: 'member@example.com',
  name: 'Dash Member',
  role: 'user',
  password_hash: '$2b$12$placeholder',
  email_verified_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}
const ADMIN = { ...USER, id: 'dash-admin-01', email: 'admin@example.com', role: 'admin' }

function signTestToken(user) {
  return jwt.sign({ userId: user.id }, privateKey, { algorithm: 'RS256', expiresIn: '15m' })
}

beforeEach(() => {
  db._reset()
  jest.clearAllMocks()
})


// ── GET /api/admin/churn ───────────────────────────────────────────────────
describe('GET /api/admin/churn', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/admin/churn')
    expect(res.status).toBe(401)
  })

  it('returns 403 for an authenticated non-admin member', async () => {
    db.oneOrNone.mockResolvedValueOnce(USER)
    const res = await request(app)
      .get('/api/admin/churn')
      .set('Authorization', `Bearer ${signTestToken(USER)}`)
    expect(res.status).toBe(403)
  })

  it('returns a 400 when period is unknown', async () => {
    db.oneOrNone.mockResolvedValueOnce(ADMIN)
    const res = await request(app)
      .get('/api/admin/churn?period=year')
      .set('Authorization', `Bearer ${signTestToken(ADMIN)}`)
    expect(res.status).toBe(400)
  })

  it('returns churn summary shape for an admin (defaults to month)', async () => {
    db.oneOrNone.mockResolvedValueOnce(ADMIN)
    // In Promise.all order: active / activeMrr / churned / churnedMrr.
    db.one
      .mockResolvedValueOnce({ count: 80 })
      .mockResolvedValueOnce({ cents: 4000000 })
      .mockResolvedValueOnce({ count: 8 })
      .mockResolvedValueOnce({ cents: 200000 })

    const res = await request(app)
      .get('/api/admin/churn')
      .set('Authorization', `Bearer ${signTestToken(ADMIN)}`)

    expect(res.status).toBe(200)
    expect(res.body.period).toBe('month')
    expect(res.body.activeCount).toBe(80)
    expect(res.body.churnedCount).toBe(8)
    // 8 / (80 + 8) a 9.09%
    expect(res.body.churnRate).toBeCloseTo(9.09, 2)
    expect(res.body.currentMrr).toBe(4000000)
    expect(res.body.churnedMrr).toBe(200000)
    // 200000 / (4000000 + 200000) a 4.76%
    expect(res.body.mrrChurnRate).toBeCloseTo(4.76, 2)
    expect(Array.isArray(res.body.cohorts)).toBe(true)
  })

  it('applies a cohort trend when cohort is supplied', async () => {
    db.oneOrNone.mockResolvedValueOnce(ADMIN)
    db.one
      .mockResolvedValueOnce({ count: 100 })
      .mockResolvedValueOnce({ cents: 1000000 })
      .mockResolvedValueOnce({ count: 4 })
      .mockResolvedValueOnce({ cents: 50000 })
    db.any.mockResolvedValueOnce([
      { bucket: '2026-08-01T00:00:00.000Z', churned: 3, mrr_cents: 30000 },
      { bucket: '2026-09-01T00:00:00.000Z', churned: 4, mrr_cents: 50000 },
    ])

    const res = await request(app)
      .get('/api/admin/churn?period=all&cohort=month')
      .set('Authorization', `Bearer ${signTestToken(ADMIN)}`)

    expect(res.status).toBe(200)
    expect(res.body.cohort).toBe('month')
    expect(res.body.cohorts).toHaveLength(2)
    expect(res.body.cohorts[0]).toHaveProperty('label')
    expect(res.body.cohorts[0]).toHaveProperty('churned', 3)
  })
})


// ── GET /api/admin/credits ────────────────────────────────────────────────
describe('GET /api/admin/credits', () => {
  it('returns 403 for a non-admin', async () => {
    db.oneOrNone.mockResolvedValueOnce(USER)
    const res = await request(app)
      .get('/api/admin/credits')
      .set('Authorization', `Bearer ${signTestToken(USER)}`)
    expect(res.status).toBe(403)
  })

  it('returns a paginated balance list for an admin', async () => {
    db.oneOrNone.mockResolvedValueOnce(ADMIN)
    db.any.mockResolvedValueOnce([
      { user_id: 1, name: 'Alice', email: 'a@example.com', balance: 500 },
      { user_id: 2, name: 'Bob', email: 'b@example.com', balance: 120 },
    ])
    db.one.mockResolvedValueOnce({ count: 2 })

    const res = await request(app)
      .get('/api/admin/credits?page=1&limit=20')
      .set('Authorization', `Bearer ${signTestToken(ADMIN)}`)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(2)
    expect(res.body.credits).toHaveLength(2)
    expect(res.body.credits[0]).toHaveProperty('balance', 500)
  })
})


// ── GET /api/admin/credits/:userId ────────────────────────────────────────
describe('GET /api/admin/credits/:userId', () => {
  it('returns the balance and recent history for an admin', async () => {
    db.oneOrNone.mockResolvedValueOnce(ADMIN)
    // Inside tx (Promise.all): user lookup, then credit, then any for history.
    db.oneOrNone
      .mockResolvedValueOnce({ id: 9, name: 'Carol', email: 'carol@example.com' })
      .mockResolvedValueOnce({ id: 20, user_id: 9, amount: 275 })
    db.any.mockResolvedValueOnce([
      { id: 1, amount: 1, type: 'credits', credits: 275, price: 0, status: 'completed', description: 'Compensation' },
    ])

    const res = await request(app)
      .get('/api/admin/credits/9')
      .set('Authorization', `Bearer ${signTestToken(ADMIN)}`)

    expect(res.status).toBe(200)
    expect(res.body.balance).toBe(275)
    expect(res.body.user.email).toBe('carol@example.com')
    expect(res.body.transactions).toHaveLength(1)
  })

  it('returns 404 when the user does not exist', async () => {
    db.oneOrNone.mockResolvedValueOnce(ADMIN)
    db.oneOrNone.mockResolvedValueOnce(null)
    db.any.mockResolvedValueOnce([])

    const res = await request(app)
      .get('/api/admin/credits/404')
      .set('Authorization', `Bearer ${signTestToken(ADMIN)}`)

    expect(res.status).toBe(404)
  })
})


// ── POST /api/admin/credits/:userId/adjust ────────────────────────────────
describe('POST /api/admin/credits/:userId/adjust', () => {
  it('rejects a non-zero-integer amount', async () => {
    db.oneOrNone.mockResolvedValueOnce(ADMIN)
    const res = await request(app)
      .post('/api/admin/credits/9/adjust')
      .set('Authorization', `Bearer ${signTestToken(ADMIN)}`)
      .send({ amount: 'lots', note: 'oops' })
    expect(res.status).toBe(400)
  })

  it('applies an adjustment and records the ledger for an admin', async () => {
    db.oneOrNone.mockResolvedValueOnce(ADMIN)
    // tx order: user find (oneOrNone) then guarded update (oneOrNone).
    db.oneOrNone
      .mockResolvedValueOnce({ id: 9 })
      .mockResolvedValueOnce({ amount: 250 })
    db.one.mockResolvedValueOnce({
      id: 77,
      type: 'credits',
      credits: 100,
      status: 'completed',
      description: 'Goodwill credit',
      created_at: new Date().toISOString(),
    })

    const res = await request(app)
      .post('/api/admin/credits/9/adjust')
      .set('Authorization', `Bearer ${signTestToken(ADMIN)}`)
      .send({ amount: 100, note: 'Goodwill credit' })

    expect(res.status).toBe(201)
    expect(res.body.balance).toBe(250)
    expect(res.body.adjustment).toBe(100)
    expect(res.body.transaction.type).toBe('credits')
  })

  it('returns 409 when a negative adjustment would undercut the balance', async () => {
    db.oneOrNone.mockResolvedValueOnce(ADMIN)
    db.oneOrNone
      .mockResolvedValueOnce({ id: 9 }) // user exists
      .mockResolvedValueOnce(null) // guarded update matched nothing
    db.one.mockResolvedValueOnce({})

    const res = await request(app)
      .post('/api/admin/credits/10/adjust')
      .set('Authorization', `Bearer ${signTestToken(ADMIN)}`)
      .send({ amount: -5000, note: 'clawback' })

    expect(res.status).toBe(409)
  })

  it('returns 404 when the target user does not exist', async () => {
    db.oneOrNone.mockResolvedValueOnce(ADMIN)
    db.oneOrNone.mockResolvedValueOnce(null)

    const res = await request(app)
      .post('/api/admin/credits/404/adjust')
      .set('Authorization', `Bearer ${signTestToken(ADMIN)}`)
      .send({ amount: 50, note: 'welcome credits' })

    expect(res.status).toBe(404)
  })
})

