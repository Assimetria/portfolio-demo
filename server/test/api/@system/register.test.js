/**
 * API tests for POST /api/auth/register
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

  const mockDb = {
    _users: users,
    _refreshTokens: refreshTokens,
    _reset() {
      users.clear()
      refreshTokens.clear()
    },

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
  return { client, isReady: () => false }
})

// ── Mock Email service ─────────────────────────────────────────────────────
jest.mock('../../../src/lib/@system/Email', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}))

// Generate JWT key pair BEFORE loading the app so the jwt module captures
// valid keys at module load time (keys are read once at require-time).
const crypto = require('crypto')
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})
process.env.JWT_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n')
process.env.JWT_PUBLIC_KEY = publicKey.replace(/\n/g, '\\n')

// Feature modules: this suite exercises the `selfRegistration` module, which the
// informational brand.json switches off. Enable it for this file only —
// Helpers/modules.js reads MODULES_JSON when the app loads.
process.env.MODULES_JSON = JSON.stringify({ selfRegistration: true })
afterAll(() => { delete process.env.MODULES_JSON })
const app = require('../../../src/app')
const db = require('../../../src/lib/@system/PostgreSQL')
const { client: redis } = require('../../../src/lib/@system/Redis')

beforeEach(() => {
  db._reset()
  redis._reset()
  jest.clearAllMocks()
})

describe('POST /api/auth/register', () => {
  const validPayload = {
    email: 'newuser@example.com',
    password: 'SecurePass123',
    name: 'Test User',
  }

  it('returns 201 with valid data and sets auth cookies', async () => {
    // findByEmail returns null (no existing user)
    db.oneOrNone.mockResolvedValue(null)
    // UserRepo.create returns the new user
    db.one
      .mockResolvedValueOnce({ id: 1, email: 'newuser@example.com', name: 'Test User', role: 'user' })
      // RefreshTokenRepo.create returns a token record
      .mockResolvedValueOnce({ id: 1, user_id: 1, token_hash: 'hash' })

    const res = await request(app)
      .post('/api/auth/register')
      .send(validPayload)

    expect(res.status).toBe(201)
    expect(res.body.user).toMatchObject({
      id: 1,
      email: 'newuser@example.com',
      name: 'Test User',
    })

    // Should set access_token and refresh_token cookies
    const cookies = res.headers['set-cookie']
    expect(cookies).toBeDefined()
    const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : cookies
    expect(cookieStr).toMatch(/access_token/)
    expect(cookieStr).toMatch(/refresh_token/)
  })

  it('returns 409 when email already exists', async () => {
    // findByEmail returns an existing user
    db.oneOrNone.mockResolvedValue({ id: 1, email: 'newuser@example.com' })

    const res = await request(app)
      .post('/api/auth/register')
      .send(validPayload)

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/already exists/i)
  })

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ password: 'SecurePass123', name: 'Test' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'newuser@example.com', name: 'Test' })

    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'SecurePass123', name: 'Test' })

    expect(res.status).toBe(400)
  })

  it('returns 400 for short password (< 8 chars)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'newuser@example.com', password: 'short', name: 'Test' })

    expect(res.status).toBe(400)
  })

  it('returns 503 when DB connection fails', async () => {
    db.oneOrNone.mockRejectedValue(new Error('Connection terminated due to connection timeout'))

    const res = await request(app)
      .post('/api/auth/register')
      .send(validPayload)

    expect(res.status).toBe(503)
    expect(res.body.message).toMatch(/temporarily unavailable/i)
  })
})
