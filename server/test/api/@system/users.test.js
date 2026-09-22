/**
 * API tests for /api/users (registration, profile)
 *
 * All external dependencies (DB, Redis, Email) are mocked.
 */

const request = require('supertest')
const crypto = require('crypto')

// ── Mock PostgreSQL ────────────────────────────────────────────────────────
jest.mock('../../../src/lib/@system/PostgreSQL', () => {
  const mockDb = {
    _registeredEmails: new Set(),
    _reset() { mockDb._registeredEmails.clear() },
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
  },
  isReady: () => false,
}))

// ── Mock Email ─────────────────────────────────────────────────────────────
jest.mock('../../../src/lib/@system/Email', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}))

// Set up JWT keys so the app doesn't crash on startup
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

beforeEach(() => {
  db._reset()
  jest.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/users — Registration
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/users — register', () => {
  it('returns 400 with empty body', async () => {
    const res = await request(app).post('/api/users').send({})
    expect(res.status).toBe(400)
  })

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ password: 'ValidPass1', name: 'Test User' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ email: 'test@example.com', name: 'Test User' })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ email: 'not-an-email', password: 'ValidPass1', name: 'Test' })
    expect(res.status).toBe(400)
  })

  it('returns 400 for weak password (too short)', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ email: 'test@example.com', password: 'abc', name: 'Test' })
    expect(res.status).toBe(400)
  })

  it('returns 400 for weak password (no uppercase)', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ email: 'test@example.com', password: 'alllowercase1', name: 'Test' })
    expect(res.status).toBe(400)
  })

  it('returns 400 for weak password (no number)', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ email: 'test@example.com', password: 'NoNumbers', name: 'Test' })
    expect(res.status).toBe(400)
  })

  it('returns 409 when email is already registered', async () => {
    // Simulate existing user in DB
    db.oneOrNone.mockResolvedValue({ id: 'existing-id', email: 'taken@example.com' })

    const res = await request(app)
      .post('/api/users')
      .send({ email: 'taken@example.com', password: 'ValidP@ssword1', name: 'Test' })

    expect([409, 429]).toContain(res.status)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/users/me — Current user profile
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/users/me', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/users/me')
    expect(res.status).toBe(401)
  })

  it('returns 401 with invalid token', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer invalid.token.here')
    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/users/me — Profile updates
// ─────────────────────────────────────────────────────────────────────────────
describe('PATCH /api/users/me', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .send({ name: 'New Name' })
    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/users/password/request — Password reset request
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/users/password/request', () => {
  it('returns 400 without email', async () => {
    const res = await request(app)
      .post('/api/users/password/request')
      .send({})
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/users/password/request')
      .send({ email: 'bad-email' })
    expect(res.status).toBe(400)
  })

  it('returns 200 or 429 for valid email (no DB leak)', async () => {
    // Security: even for non-existent emails, should return 200 (not reveal existence)
    db.oneOrNone.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/users/password/request')
      .send({ email: 'doesnotexist@example.com' })

    // Either 200 (silently succeeds) or 429 (rate limited)
    expect([200, 429]).toContain(res.status)
  })
})
