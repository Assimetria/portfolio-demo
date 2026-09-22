/**
 * API tests for GET /api/faq (@custom)
 *
 * Tests the localization FAQ endpoint which returns hardcoded FAQ data.
 * No external deps required — all data is in-memory.
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

describe('GET /api/faq', () => {
  it('returns 200 with array of FAQ items', async () => {
    const res = await request(app).get('/api/faq')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('items')
    expect(res.body).toHaveProperty('total')
    expect(Array.isArray(res.body.items)).toBe(true)
    expect(res.body.total).toBeGreaterThan(0)
  })

  it('each FAQ item has required fields', async () => {
    const res = await request(app).get('/api/faq')
    for (const item of res.body.items) {
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('question')
      expect(item).toHaveProperty('answer')
      expect(item).toHaveProperty('category')
      expect(item).toHaveProperty('tags')
      expect(typeof item.question).toBe('string')
      expect(typeof item.answer).toBe('string')
      expect(typeof item.category).toBe('string')
      expect(Array.isArray(item.tags)).toBe(true)
    }
  })

  it('returns FAQ items about localization topics', async () => {
    const res = await request(app).get('/api/faq')
    const categories = res.body.items.map((i) => i.category)
    expect(categories).toContain('Character Encoding')
    expect(categories).toContain('Date & Time')
    expect(categories).toContain('Numbers & Currency')
    expect(categories).toContain('Translation Management')
    expect(categories).toContain('RTL Support')
  })

  it('returns JSON content-type', async () => {
    const res = await request(app).get('/api/faq')
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })

  it('rejects POST method', async () => {
    const res = await request(app).post('/api/faq')
    expect([401, 404]).toContain(res.status)
  })
})

describe('GET /api/faq/:id', () => {
  it('returns a specific FAQ item by id', async () => {
    const res = await request(app).get('/api/faq/faq-1')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('id', 'faq-1')
    expect(res.body).toHaveProperty('question')
    expect(res.body).toHaveProperty('answer')
  })

  it('returns 404 for non-existent FAQ id', async () => {
    const res = await request(app).get('/api/faq/non-existent-id')
    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('message')
  })
})