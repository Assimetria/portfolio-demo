/**
 * API tests for GET /api/webhook-benchmark (@custom)
 *
 * Tests benchmark response structure, strategy results, summary aggregation,
 * and error handling for invalid query parameters.
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
process.env.CSRF_SECRET = 'test-csrf-secret-not-secure-32chars!!'

const app = require('../../../src/app')
const db = require('../../../src/lib/@system/PostgreSQL')

beforeEach(() => {
  jest.clearAllMocks()
  db.one.mockResolvedValue({ '?column?': 1 })
  const UserRepo = require('../../../src/db/repos/@system/UserRepo')
  UserRepo.findById.mockResolvedValue({
    id: 1,
    email: 'admin@test.com',
    name: 'Test Admin',
    role: 'admin',
    plan: 'pro',
  })
})

let token
beforeAll(async () => {
  const jwt = require('jsonwebtoken')
  token = jwt.sign(
    { sub: 1, role: 'admin', plan: 'pro' },
    { key: privateKey, passphrase: '' },
    { algorithm: 'RS256', expiresIn: '1h' }
  )
})
describe('GET /api/webhook-benchmark', () => {
  // ── Auth ─────────────────────────────────────────────────────────────────
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/webhook-benchmark')
    expect(res.status).toBe(401)
  })

  it('returns 401 with an invalid bearer token', async () => {
    const res = await request(app)
      .get('/api/webhook-benchmark')
      .set('Authorization', 'Bearer invalid.token.here')
    expect(res.status).toBe(401)
  })

  // ── Response structure ───────────────────────────────────────────────────
  it('returns the expected JSON envelope', async () => {
    const res = await request(app)
      .get('/api/webhook-benchmark')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.config).toBeDefined()
    expect(res.body.strategies).toBeInstanceOf(Array)
    expect(res.body.summary).toBeDefined()
  })

  it('includes config object with default values', async () => {
    const res = await request(app)
      .get('/api/webhook-benchmark')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body.config).toMatchObject({
      rounds: 3,
      webhooks: 5,
      latencyMs: 50,
      errorRate: 0,
    })
  })

  // ── Strategy results ────────────────────────────────────────────────────
  it('returns results for all three strategies', async () => {
    const res = await request(app)
      .get('/api/webhook-benchmark')
      .set('Authorization', `Bearer ${token}`)

    const strategies = res.body.strategies
    const names = [...new Set(strategies.map((s) => s.strategy))]
    expect(names).toContain('concurrent')
    expect(names).toContain('sequential')
    expect(names).toContain('batched')
  })

  it('each strategy result has required metric fields', async () => {
    const res = await request(app)
      .get('/api/webhook-benchmark')
      .set('Authorization', `Bearer ${token}`)

    for (const s of res.body.strategies) {
      expect(s).toHaveProperty('strategy')
      expect(s).toHaveProperty('round')
      expect(s).toHaveProperty('totalRequests')
      expect(s).toHaveProperty('totalDurationMs')
      expect(s).toHaveProperty('avgLatencyMs')
      expect(s).toHaveProperty('p50LatencyMs')
      expect(s).toHaveProperty('p95LatencyMs')
      expect(s).toHaveProperty('p99LatencyMs')
      expect(s).toHaveProperty('throughput')
      expect(s).toHaveProperty('successCount')
      expect(s).toHaveProperty('failedCount')
      expect(s).toHaveProperty('successRate')
      expect(typeof s.strategy).toBe('string')
      expect(typeof s.totalDurationMs).toBe('number')
      expect(typeof s.avgLatencyMs).toBe('number')
      expect(typeof s.throughput).toBe('number')
      expect(typeof s.successRate).toBe('number')
    }
  })

  it('totalRequests matches the configured webhook count', async () => {
    const res = await request(app)
      .get('/api/webhook-benchmark?webhooks=3')
      .set('Authorization', `Bearer ${token}`)

    for (const s of res.body.strategies) {
      expect(s.totalRequests).toBe(3)
    }
  })
// ── Summary ────────────────────────────────────────────────────────────
  it('summary contains entries for all three strategies', async () => {
    const res = await request(app)
      .get('/api/webhook-benchmark')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body.summary).toHaveProperty('concurrent')
    expect(res.body.summary).toHaveProperty('sequential')
    expect(res.body.summary).toHaveProperty('batched')
  })

  it('each summary entry has required fields', async () => {
    const res = await request(app)
      .get('/api/webhook-benchmark')
      .set('Authorization', `Bearer ${token}`)

    for (const [name, data] of Object.entries(res.body.summary)) {
      expect(data).toHaveProperty('avgTotalDurationMs')
      expect(data).toHaveProperty('avgLatencyMs')
      expect(data).toHaveProperty('avgThroughput')
      expect(data).toHaveProperty('avgSuccessRate')
      expect(data).toHaveProperty('rounds')
      expect(typeof data.avgTotalDurationMs).toBe('number')
      expect(typeof data.rounds).toBe('number')
    }
  })

  // ── Query params ──────────────────────────────────────────────────────
  it('respects custom rounds parameter', async () => {
    const res = await request(app)
      .get('/api/webhook-benchmark?rounds=1')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body.config.rounds).toBe(1)
    expect(res.body.strategies).toHaveLength(3)
  })

  it('respects custom latencyMs parameter', async () => {
    const res = await request(app)
      .get('/api/webhook-benchmark?latencyMs=100')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body.config.latencyMs).toBe(100)
  })

  it('clamps rounds to max 10', async () => {
    const res = await request(app)
      .get('/api/webhook-benchmark?rounds=999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body.config.rounds).toBe(10)
  })

  it('clamps webhooks to max 20', async () => {
    const res = await request(app)
      .get('/api/webhook-benchmark?webhooks=999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body.config.webhooks).toBe(20)
  })

  it('clamps latencyMs to max 500', async () => {
    const res = await request(app)
      .get('/api/webhook-benchmark?latencyMs=9999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body.config.latencyMs).toBe(500)
  })

  it('clamps errorRate to 0–1 range', async () => {
    const res = await request(app)
      .get('/api/webhook-benchmark?errorRate=999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body.config.errorRate).toBe(1)
  })

  it('uses default values for missing params', async () => {
    const res = await request(app)
      .get('/api/webhook-benchmark')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body.config.rounds).toBe(3)
    expect(res.body.config.webhooks).toBe(5)
    expect(res.body.config.latencyMs).toBe(50)
    expect(res.body.config.errorRate).toBe(0)
  })

  // ── Edge cases ──────────────────────────────────────────────────────────
  it('returns 200 for minimum valid params', async () => {
    const res = await request(app)
      .get('/api/webhook-benchmark?rounds=1&webhooks=1&latencyMs=1')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.config.rounds).toBe(1)
    expect(res.body.config.webhooks).toBe(1)
    expect(res.body.config.latencyMs).toBe(1)
  })

  it('correctly calculates success rate fractions', async () => {
    const res = await request(app)
      .get('/api/webhook-benchmark?rounds=1&webhooks=5&errorRate=0.5')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    for (const s of res.body.strategies) {
      expect(s.successCount + s.failedCount).toBe(s.totalRequests)
      expect(s.successRate).toBeGreaterThanOrEqual(0)
      expect(s.successRate).toBeLessThanOrEqual(100)
    }
  })
})
