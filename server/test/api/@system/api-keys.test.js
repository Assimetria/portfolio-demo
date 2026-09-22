/**
 * API tests for /api/api-keys endpoint
 *
 * All DB / Redis dependencies are mocked.
 */

const request = require('supertest')
const crypto = require('crypto')

jest.mock('../../../src/lib/@system/PostgreSQL', () => ({
  one: jest.fn(),
  oneOrNone: jest.fn(),
  none: jest.fn(),
  any: jest.fn(),
  tx: jest.fn(async (fn) => fn(this)),
}))

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

// Feature modules: this suite exercises the `apiKeys` module, which the
// informational brand.json switches off. Enable it for this file only —
// Helpers/modules.js reads MODULES_JSON when the app loads.
process.env.MODULES_JSON = JSON.stringify({ apiKeys: true })
afterAll(() => { delete process.env.MODULES_JSON })
const app = require('../../../src/app')

describe('GET /api/api-keys', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/api-keys')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/api-keys', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/api-keys')
      .send({ name: 'My Key' })
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/api-keys/:id', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/api/api-keys/some-id')
    expect(res.status).toBe(401)
  })
})
