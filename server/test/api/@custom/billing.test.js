/**
 * API tests for GET /api/billing (@custom)
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

describe('GET /api/billing', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/billing')
    expect(res.status).toBe(401)
  })

  it('returns 401 with invalid bearer token', async () => {
    const res = await request(app)
      .get('/api/billing')
      .set('Authorization', 'Bearer bad.token.value')
    expect(res.status).toBe(401)
  })

  it('returns 401 with a random 96-hex opaque token (unknown session)', async () => {
    const fakeToken = crypto.randomBytes(48).toString('hex')
    const res = await request(app)
      .get('/api/billing')
      .set('Authorization', `Bearer ${fakeToken}`)
    expect(res.status).toBe(401)
  })

  it('returns 401 without valid X-API-Key', async () => {
    const res = await request(app)
      .get('/api/billing')
      .set('X-API-Key', 'invalid-key')
    expect(res.status).toBe(401)
  })

  it('returns JSON on unauthorized', async () => {
    const res = await request(app).get('/api/billing')
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })
})
