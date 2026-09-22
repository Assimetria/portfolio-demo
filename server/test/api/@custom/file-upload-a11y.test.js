/**
 * API tests for GET /api/file-upload-a11y (@custom)
 *
 * Tests the file-upload accessibility standards endpoint which returns
 * hardcoded research data. No external deps required — all data is in-memory.
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

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/file-upload-a11y', () => {
  it('returns 200 with array of accessibility standards', async () => {
    const res = await request(app).get('/api/file-upload-a11y')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('items')
    expect(res.body).toHaveProperty('total')
    expect(Array.isArray(res.body.items)).toBe(true)
    expect(res.body.total).toBeGreaterThan(0)
  })

  it('each standard has required fields', async () => {
    const res = await request(app).get('/api/file-upload-a11y')
    for (const item of res.body.items) {
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('title')
      expect(item).toHaveProperty('summary')
      expect(item).toHaveProperty('criteria')
      expect(item).toHaveProperty('details')
      expect(item).toHaveProperty('wcagRef')
      expect(item).toHaveProperty('tags')
      expect(typeof item.title).toBe('string')
      expect(typeof item.summary).toBe('string')
      expect(typeof item.criteria).toBe('string')
      expect(typeof item.details).toBe('string')
      expect(typeof item.wcagRef).toBe('string')
      expect(Array.isArray(item.tags)).toBe(true)
    }
  })

  it('covers keyboard and focus related topics', async () => {
    const res = await request(app).get('/api/file-upload-a11y')
    const titles = res.body.items.map((i) => i.title)
    expect(titles).toContain('Keyboard Operability (WCAG 2.1.1)')
    expect(titles).toContain('Focus Management (WCAG 2.4.3)')
    expect(titles).toContain('Name, Role, Value (WCAG 4.1.2 / ARIA)')
  })

  it('returns JSON content-type', async () => {
    const res = await request(app).get('/api/file-upload-a11y')
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })

  it('rejects POST method', async () => {
    const res = await request(app).post('/api/file-upload-a11y')
    expect([401, 404]).toContain(res.status)
  })
})

describe('GET /api/file-upload-a11y/:id', () => {
  it('returns a specific standard by id', async () => {
    const res = await request(app).get('/api/file-upload-a11y/a11y-1')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('id', 'a11y-1')
    expect(res.body).toHaveProperty('title')
    expect(res.body).toHaveProperty('details')
  })

  it('returns 404 for non-existent standard id', async () => {
    const res = await request(app).get('/api/file-upload-a11y/non-existent-id')
    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('message')
  })
})