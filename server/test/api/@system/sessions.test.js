/**
 * API tests for /api/sessions (auth endpoints)
 *
 * These tests run against the Express app WITHOUT a real DB or Redis.
 * Both dependencies are mocked so the tests are fast, deterministic, and
 * runnable in CI without any external services.
 */

const request = require('supertest')

// ── Mock PostgreSQL ────────────────────────────────────────────────────────
jest.mock('../../../src/lib/@system/PostgreSQL', () => {
  const users = new Map()
  const refreshTokens = new Map()
  const sessions = new Map()

  const mockDb = {
    _users: users,
    _sessions: sessions,
    _refreshTokens: refreshTokens,
    _reset() {
      users.clear()
      refreshTokens.clear()
      sessions.clear()
    },

    // Generic query methods used by repos
    one: jest.fn(),
    oneOrNone: jest.fn(),
    none: jest.fn(),
    any: jest.fn(),
    tx: jest.fn(async (fn) => fn(mockDb)),
  }

  return mockDb
})

// ── Mock Redis ─────────────────────────────────────────────────────────────
jest.mock('../../../src/lib/@system/Redis', () => {
  const store = new Map()
  const client = {
    get: jest.fn(async (k) => store.get(k) ?? null),
    set: jest.fn(async (k, v) => store.set(k, v)),
    del: jest.fn(async (k) => store.delete(k)),
    exists: jest.fn(async (k) => (store.has(k) ? 1 : 0)),
    incr: jest.fn(async (k) => {
      const n = parseInt(store.get(k) ?? '0', 10) + 1
      store.set(k, String(n))
      return n
    }),
    expire: jest.fn(),
    ttl: jest.fn(async () => -1),
    _store: store,
    _reset: () => store.clear(),
  }
  return { client, isReady: () => false } // Redis not ready → rate-limit bypass / no blacklist
})

// ── Mock Email service ─────────────────────────────────────────────────────
jest.mock('../../../src/lib/@system/Email', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}))

// Feature modules: this suite exercises the `selfRegistration` module, which the
// informational brand.json switches off. Enable it for this file only —
// Helpers/modules.js reads MODULES_JSON when the app loads.
process.env.MODULES_JSON = JSON.stringify({ selfRegistration: true })
afterAll(() => { delete process.env.MODULES_JSON })
const app = require('../../../src/app')
const db = require('../../../src/lib/@system/PostgreSQL')
const { client: redis } = require('../../../src/lib/@system/Redis')

// Helpers to generate valid JWT key pairs for tests
const crypto = require('crypto')
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})
process.env.JWT_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n')
process.env.JWT_PUBLIC_KEY = publicKey.replace(/\n/g, '\\n')

beforeEach(() => {
  db._reset()
  redis._reset()
  jest.resetAllMocks()
})

describe('POST /api/sessions/register — signup', () => {
  const validPayload = {
    email: 'newuser@example.com',
    password: 'SecurePass123',
    name: 'Test User',
  }

  it('returns 409 when email already exists', async () => {
    db.oneOrNone.mockResolvedValue({ id: 1, email: 'newuser@example.com' })

    const res = await request(app)
      .post('/api/sessions/register')
      .send(validPayload)

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/already exists/i)
  })

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/sessions/register')
      .send({ password: 'SecurePass123', name: 'Test' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/sessions/register')
      .send({ email: 'newuser@example.com', name: 'Test' })

    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid email', async () => {
    const res = await request(app)
      .post('/api/sessions/register')
      .send({ email: 'not-an-email', password: 'SecurePass123', name: 'Test' })

    expect(res.status).toBe(400)
  })

  it('returns 400 for short password (< 8 chars)', async () => {
    const res = await request(app)
      .post('/api/sessions/register')
      .send({ email: 'newuser@example.com', password: 'short', name: 'Test' })

    expect(res.status).toBe(400)
  })

  it('returns 503 when DB connection fails', async () => {
    db.oneOrNone.mockRejectedValueOnce(new Error('Connection terminated due to connection timeout'))

    const res = await request(app)
      .post('/api/sessions/register')
      .send(validPayload)

    expect(res.status).toBe(503)
    expect(res.body.message).toMatch(/temporarily unavailable/i)
  })
})

describe('POST /api/sessions — login', () => {
  it('returns 400 when body is missing', async () => {
    const res = await request(app).post('/api/sessions').send({})
    expect(res.status).toBe(400)
  })

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ password: 'Password1' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ email: 'user@example.com' })
    expect(res.status).toBe(400)
  })

  it('returns 400 for malformed email', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ email: 'not-an-email', password: 'Password1' })
    expect(res.status).toBe(400)
  })

  it('returns 401 for unknown user', async () => {
    // DB returns null for unknown email (user not found)
    db.oneOrNone.mockResolvedValue(null)
    db.one.mockRejectedValue(new Error('No data returned'))

    const res = await request(app)
      .post('/api/sessions')
      .send({ email: 'nobody@nowhere.invalid', password: 'Password1' })

    // 401 Unauthorized or 429 rate-limited — both are valid rejection responses
    expect([401, 429]).toContain(res.status)
  })

  it('returns 503 when DB connection fails', async () => {
    db.oneOrNone.mockRejectedValueOnce(new Error('Connection terminated due to connection timeout'))

    const res = await request(app)
      .post('/api/sessions')
      .send({ email: 'user@example.com', password: 'Password1' })

    expect(res.status).toBe(503)
    expect(res.body.message).toMatch(/temporarily unavailable/i)
  })
})

describe('GET /api/sessions/me — current user', () => {
  it('returns 200 with null user without Authorization header', async () => {
    const res = await request(app).get('/api/sessions/me')
    expect(res.status).toBe(200)
    expect(res.body.user).toBeNull()
  })

  it('returns 200 with null user for malformed bearer token', async () => {
    const res = await request(app)
      .get('/api/sessions/me')
      .set('Authorization', 'Bearer not.a.valid.token')
    expect(res.status).toBe(200)
    expect(res.body.user).toBeNull()
  })

  it('returns 200 with null user for empty bearer token', async () => {
    const res = await request(app)
      .get('/api/sessions/me')
      .set('Authorization', 'Bearer ')
    expect(res.status).toBe(200)
    expect(res.body.user).toBeNull()
  })
})

describe('DELETE /api/sessions — logout', () => {
  it('returns 200 even without auth (idempotent logout)', async () => {
    // The logout endpoint clears cookies and returns 200 regardless of auth state.
    // This is intentional: a user who is already logged out should be able to
    // call this endpoint without receiving an error.
    const res = await request(app).delete('/api/sessions')
    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/logged out/i)
  })
})
