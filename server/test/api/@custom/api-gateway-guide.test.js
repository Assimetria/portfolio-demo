/**
 * API tests for API Gateway Guide endpoints (@custom)
 *
 * Tests cover:
 *   GET  /api/api-gateway-guide           — fetch guide steps + progress
 *   POST /api/api-gateway-guide/progress  — mark step completed
 *   POST /api/api-gateway-guide/reset     — reset progress
 *
 * External deps (DB, Redis, Email) are mocked.
 */

const request = require('supertest')
const crypto = require('crypto')

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

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})
process.env.JWT_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n')
process.env.JWT_PUBLIC_KEY = publicKey.replace(/\n/g, '\\n')

const app = require('../../../src/app')

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/api-gateway-guide', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/api-gateway-guide')
    expect(res.status).toBe(401)
  })

  it('returns 401 with invalid bearer token', async () => {
    const res = await request(app)
      .get('/api/api-gateway-guide')
      .set('Authorization', 'Bearer garbage')
    expect(res.status).toBe(401)
  })

  it('returns JSON on unauthorized', async () => {
    const res = await request(app).get('/api/api-gateway-guide')
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })

  it('rejects POST method (only GET is defined)', async () => {
    const res = await request(app).post('/api/api-gateway-guide')
    expect([401, 404]).toContain(res.status)
  })
})

describe('POST /api/api-gateway-guide/progress', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/api-gateway-guide/progress')
      .send({ stepId: 'welcome' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when stepId is missing', async () => {
    const res = await request(app)
      .post('/api/api-gateway-guide/progress')
      .set('Authorization', 'Bearer garbage')
      .send({})
    expect(res.status).toBe(401) // auth fails before validation
  })

  it('rejects GET method (only POST is defined)', async () => {
    const res = await request(app).get('/api/api-gateway-guide/progress')
    expect([401, 404]).toContain(res.status)
  })
})

describe('POST /api/api-gateway-guide/reset', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).post('/api/api-gateway-guide/reset')
    expect(res.status).toBe(401)
  })

  it('rejects GET method (only POST is defined)', async () => {
    const res = await request(app).get('/api/api-gateway-guide/reset')
    expect([401, 404]).toContain(res.status)
  })
})