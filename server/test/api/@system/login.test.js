/**
 * API tests for POST /api/auth/login
 *
 * All external dependencies (DB, Redis, bcrypt) are mocked so tests are
 * fast and runnable in CI without any real services.
 */

const request = require('supertest')

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

// ── Mock bcryptjs — avoids slow real hashing in unit tests ────────────────
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2a$12$hashedpassword'),
  compare: jest.fn(),
}))

// Generate JWT keys before loading the app so jwt module captures valid keys
const crypto = require('crypto')
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})
process.env.JWT_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n')
process.env.JWT_PUBLIC_KEY = publicKey.replace(/\n/g, '\\n')

const app = require('../../../src/app')
const db = require('../../../src/lib/@system/PostgreSQL')
const { client: redis } = require('../../../src/lib/@system/Redis')
const bcrypt = require('bcryptjs')

const VALID_USER = {
  id: 42,
  email: 'user@example.com',
  name: 'Alice',
  role: 'user',
  password_hash: '$2a$12$hashedpassword',
}

const VALID_REFRESH_RECORD = {
  id: 1,
  user_id: 42,
  token_hash: 'abc123',
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
}

beforeEach(() => {
  db._reset()
  redis._reset()
  jest.clearAllMocks()
})

// ── POST /api/auth/login ──────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'SecurePass123' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com' })

    expect(res.status).toBe(400)
  })

  it('returns 400 for malformed email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'SecurePass123' })

    expect(res.status).toBe(400)
  })

  it('returns 401 when user is not found', async () => {
    db.oneOrNone.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@nowhere.invalid', password: 'SecurePass123' })

    expect([401, 429]).toContain(res.status)
  })

  it('returns 401 when password is wrong', async () => {
    db.oneOrNone.mockResolvedValue(VALID_USER)
    bcrypt.compare.mockResolvedValue(false)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'WrongPassword' })

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/invalid credentials/i)
  })

  it('returns 401 for an OAuth-only account (no password_hash)', async () => {
    db.oneOrNone.mockResolvedValue({ ...VALID_USER, password_hash: null })

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'AnyPassword1' })

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/social login/i)
  })

  it('returns 200 with auth cookies on valid credentials', async () => {
    db.oneOrNone.mockResolvedValue(VALID_USER)
    bcrypt.compare.mockResolvedValue(true)
    // RefreshTokenRepo.create → db.one returns the refresh record + raw token
    db.one.mockResolvedValue(VALID_REFRESH_RECORD)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'SecurePass123' })

    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ id: 42, email: 'user@example.com' })

    const cookies = res.headers['set-cookie']
    expect(cookies).toBeDefined()
    const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : cookies
    expect(cookieStr).toMatch(/access_token/)
    expect(cookieStr).toMatch(/refresh_token/)
  })

  it('returns 503 when DB connection fails', async () => {
    db.oneOrNone.mockRejectedValue(new Error('Connection terminated due to connection timeout'))

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'SecurePass123' })

    expect(res.status).toBe(503)
    expect(res.body.message).toMatch(/temporarily unavailable/i)
  })
})
