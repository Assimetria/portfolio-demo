/**
 * API tests for push-notifications Lambda processor bridge (@custom / [SV4-172])
 *
 * Tests the Express API routes that bridge to the Lambda handler.
 * External deps (DB, Redis, Email) are mocked so the suite runs in CI
 * without any external services. The Lambda handler module is also mocked
 * to isolate the API routing from the actual Lambda implementation.
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

// ── Mock Logger ───────────────────────────────────────────────────────────
jest.mock('../../../src/lib/@system/Logger', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn(() => mockLogger),
  }
  return mockLogger
})

// ── Mock the Lambda handler module ─────────────────────────────────────────
const mockReadProcessorState = jest.fn()
const mockHandler = jest.fn()

jest.mock('../../../src/lambda/@custom/push-notifications', () => ({
  readProcessorState: (...args) => mockReadProcessorState(...args),
  handler: (...args) => mockHandler(...args),
  processBatch: jest.fn(),
  processNotification: jest.fn(),
  writeProcessorState: jest.fn(),
  inMemoryStore: { totalProcessed: 0, failedCount: 0, lastProcessedAt: null, status: 'idle' },
}))

// Set up JWT keys BEFORE requiring the app
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})
process.env.JWT_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n')
process.env.JWT_PUBLIC_KEY = publicKey.replace(/\n/g, '\\n')

describe('GET /api/push-notifications/status', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/push-notifications/status')
    expect(res.status).toBe(401)
  })

  it('returns 401 with an invalid bearer token', async () => {
    const res = await request(app)
      .get('/api/push-notifications/status')
      .set('Authorization', 'Bearer invalid.token.here')
    expect(res.status).toBe(401)
  })

  it('returns 401 with a malformed Authorization header', async () => {
    const res = await request(app)
      .get('/api/push-notifications/status')
      .set('Authorization', 'NotBearer some-value')
    expect(res.status).toBe(401)
  })

  it('returns 401 with an empty bearer token', async () => {
    const res = await request(app)
      .get('/api/push-notifications/status')
      .set('Authorization', 'Bearer ')
    expect(res.status).toBe(401)
  })

  it('returns JSON content-type on the unauthorized response', async () => {
    const res = await request(app).get('/api/push-notifications/status')
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })

  it('rejects POST method (only GET is defined)', async () => {
    const res = await request(app).post('/api/push-notifications/status')
    expect([401, 404]).toContain(res.status)
  })
})

describe('POST /api/push-notifications/process', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).post('/api/push-notifications/process')
    expect(res.status).toBe(401)
  })

  it('returns 401 with invalid bearer token', async () => {
    const res = await request(app)
      .post('/api/push-notifications/process')
      .set('Authorization', 'Bearer bad.token.value')
    expect(res.status).toBe(401)
  })

  it('returns 401 with a random opaque token', async () => {
    const fakeToken = crypto.randomBytes(48).toString('hex')
    const res = await request(app)
      .post('/api/push-notifications/process')
      .set('Authorization', `Bearer ${fakeToken}`)
    expect(res.status).toBe(401)
  })

  it('returns JSON on unauthorized', async () => {
    const res = await request(app).post('/api/push-notifications/process')
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })

  it('rejects GET method (only POST is defined)', async () => {
    const res = await request(app).get('/api/push-notifications/process')
    expect([401, 404]).toContain(res.status)
  })
})
const app = require('../../../src/app')
const db = require('../../../src/lib/@system/PostgreSQL')

beforeEach(() => {
  jest.clearAllMocks()
  mockReadProcessorState.mockReset()
  mockHandler.mockReset()
})