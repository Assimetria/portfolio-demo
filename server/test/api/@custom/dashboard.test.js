/**
 * API tests for GET /api/dashboard (@custom)
 *
 * External deps (DB, Redis, Email) are mocked so the suite runs in CI
 * without any external services.
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
  },
  isReady: () => false,
}))

// ── Mock Email ─────────────────────────────────────────────────────────────
jest.mock('../../../src/lib/@system/Email', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
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
})

describe('GET /api/dashboard', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/dashboard')
    expect(res.status).toBe(401)
  })

  it('returns 401 with an invalid bearer token', async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', 'Bearer invalid.token.here')
    expect(res.status).toBe(401)
  })

  it('returns 401 with a malformed Authorization header', async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', 'NotBearer some-value')
    expect(res.status).toBe(401)
  })

  it('returns 401 with an empty bearer token', async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', 'Bearer ')
    expect(res.status).toBe(401)
  })

  it('returns JSON content-type on the unauthorized response', async () => {
    const res = await request(app).get('/api/dashboard')
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })

  it('rejects POST method (only GET is defined)', async () => {
    const res = await request(app).post('/api/dashboard')
    expect([401, 404]).toContain(res.status)
  })
})
