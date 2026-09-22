/**
 * API tests for caching strategies endpoints (@custom)
 *
 * Tests GET /api/caching/strategies and POST /api/caching/recommend.
 * External deps are mocked so the suite runs in CI without external services.
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
    ping: jest.fn(async () => 'PONG'),
  },
  isReady: jest.fn(() => true),
}))

// ── Mock UserRepo so JWT auth can find the user ────────────────────────────
jest.mock('../../../src/db/repos/@system/UserRepo', () => ({
  findById: jest.fn(async () => ({
    id: 1,
    email: 'admin@test.com',
    name: 'Test Admin',
    role: 'admin',
    plan: 'pro',
  })),
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
const UserRepo = require('../../../src/db/repos/@system/UserRepo')

let token = null

beforeAll(async () => {
  // Sign a valid JWT for authenticated requests
  const jwt = require('jsonwebtoken')
  token = jwt.sign({ sub: 1, role: 'admin' }, privateKey, {
    algorithm: 'RS256',
    expiresIn: '1h',
  })
})

beforeEach(() => {
  jest.clearAllMocks()
  db.one.mockResolvedValue({ '?column?': 1 })
  UserRepo.findById.mockResolvedValue({
    id: 1,
    email: 'admin@test.com',
    name: 'Test Admin',
    role: 'admin',
    plan: 'pro',
  })
})
describe('GET /api/caching/strategies', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/caching/strategies')
    expect(res.status).toBe(401)
  })

  it('returns 401 with an invalid bearer token', async () => {
    const res = await request(app)
      .get('/api/caching/strategies')
      .set('Authorization', 'Bearer invalid.token.here')
    expect(res.status).toBe(401)
  })

  it('returns JSON content-type on the unauthorized response', async () => {
    const res = await request(app).get('/api/caching/strategies')
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })

  it('returns all 6 strategies with ok: true', async () => {
    const res = await request(app)
      .get('/api/caching/strategies')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.count).toBe(6)
    expect(Array.isArray(res.body.strategies)).toBe(true)
    expect(res.body.strategies).toHaveLength(6)
  })

  it('each strategy has the required fields', async () => {
    const res = await request(app)
      .get('/api/caching/strategies')
      .set('Authorization', `Bearer ${token}`)

    const required = ['id', 'name', 'category', 'description', 'pros', 'cons', 'freshness', 'complexity', 'infraCost', 'requiresRedis', 'useCase']
    for (const s of res.body.strategies) {
      for (const field of required) {
        expect(s).toHaveProperty(field)
      }
    }
  })

  it('includes all known strategy IDs', async () => {
    const res = await request(app)
      .get('/api/caching/strategies')
      .set('Authorization', `Bearer ${token}`)

    const ids = res.body.strategies.map((s) => s.id).sort()
    expect(ids).toEqual([
      'db-cache',
      'http-cache',
      'in-memory',
      'redis-cache',
      'swr-client',
      'swr-server',
    ])
  })
})

describe('POST /api/caching/recommend', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).post('/api/caching/recommend')
    expect(res.status).toBe(401)
  })

  it('recommends in-memory for single-process environment', async () => {
    const res = await request(app)
      .post('/api/caching/recommend')
      .set('Authorization', `Bearer ${token}`)
      .send({ hasRedis: false, isMultiProcess: false })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.recommendation.primary.id).toBe('in-memory')
    expect(res.body.recommendation.secondary.id).toBe('swr-client')
    expect(res.body.recommendation.fallback.id).toBe('swr-server')
  })

  it('recommends redis-cache for multi-process with Redis', async () => {
    const res = await request(app)
      .post('/api/caching/recommend')
      .set('Authorization', `Bearer ${token}`)
      .send({ hasRedis: true, isMultiProcess: true })

    expect(res.status).toBe(200)
    expect(res.body.recommendation.primary.id).toBe('redis-cache')
    expect(res.body.recommendation.secondary.id).toBe('swr-client')
    expect(res.body.recommendation.fallback.id).toBe('in-memory')
  })

  it('recommends swr-client for multi-process without Redis', async () => {
    const res = await request(app)
      .post('/api/caching/recommend')
      .set('Authorization', `Bearer ${token}`)
      .send({ hasRedis: false, isMultiProcess: true })

    expect(res.status).toBe(200)
    expect(res.body.recommendation.primary.id).toBe('swr-client')
    expect(res.body.recommendation.secondary.id).toBe('http-cache')
    expect(res.body.recommendation.fallback.id).toBe('in-memory')
  })

  it('recommends in-memory for single-process with Redis (hasRedis ignored)', async () => {
    const res = await request(app)
      .post('/api/caching/recommend')
      .set('Authorization', `Bearer ${token}`)
      .send({ hasRedis: true, isMultiProcess: false })

    expect(res.status).toBe(200)
    expect(res.body.recommendation.primary.id).toBe('in-memory')
  })

  it('rejects hasRedis with non-boolean value', async () => {
    const res = await request(app)
      .post('/api/caching/recommend')
      .set('Authorization', `Bearer ${token}`)
      .send({ hasRedis: 'yes', isMultiProcess: true })

    expect(res.status).toBe(400)
  })

  it('rejects isMultiProcess with non-boolean value', async () => {
    const res = await request(app)
      .post('/api/caching/recommend')
      .set('Authorization', `Bearer ${token}`)
      .send({ hasRedis: true, isMultiProcess: 'yes' })

    expect(res.status).toBe(400)
  })

  it('accepts missing optional fields (uses defaults from process.env)', async () => {
    const res = await request(app)
      .post('/api/caching/recommend')
      .set('Authorization', `Bearer ${token}`)
      .send({})

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.recommendation.primary).toBeDefined()
    expect(res.body.recommendation.secondary).toBeDefined()
    expect(res.body.recommendation.fallback).toBeDefined()
  })
})