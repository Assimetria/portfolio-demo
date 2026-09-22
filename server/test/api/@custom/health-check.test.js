/**
 * API tests for GET /api/health-check/dependencies (@custom)
 *
 * External deps (DB, Redis, Email, Storage) are mocked so the suite runs in CI
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
    ping: jest.fn(async () => 'PONG'),
  },
  isReady: jest.fn(() => true),
}))

// ── Mock Email ─────────────────────────────────────────────────────────────
jest.mock('../../../src/lib/@system/Email', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}))

// ── Mock Storage ───────────────────────────────────────────────────────────
jest.mock('../../../src/lib/@system/StorageAdapter', () => ({
  getStatus: jest.fn().mockResolvedValue({ ok: true }),
  assertProductionSafe: jest.fn(),
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
const Redis = require('../../../src/lib/@system/Redis')

beforeEach(() => {
  jest.clearAllMocks()
  db.one.mockResolvedValue({ '?column?': 1 })
  Redis.isReady.mockReturnValue(true)
  Redis.client.ping.mockResolvedValue('PONG')
  // Re-mock UserRepo after clearAllMocks
  const UserRepo = require('../../../src/db/repos/@system/UserRepo')
  UserRepo.findById.mockResolvedValue({
    id: 1,
    email: 'admin@test.com',
    name: 'Test Admin',
    role: 'admin',
    plan: 'pro',
  })
})

describe('GET /api/health-check/dependencies', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/health-check/dependencies')
    expect(res.status).toBe(401)
  })

  it('returns 401 with an invalid bearer token', async () => {
    const res = await request(app)
      .get('/api/health-check/dependencies')
      .set('Authorization', 'Bearer invalid.token.here')
    expect(res.status).toBe(401)
  })

  it('returns JSON content-type on the unauthorized response', async () => {
    const res = await request(app).get('/api/health-check/dependencies')
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })

  it('rejects POST method (only GET is defined)', async () => {
    const res = await request(app).post('/api/health-check/dependencies')
    expect([401, 404]).toContain(res.status)
  })
})

describe('GET /api/health-check/dependencies (authenticated)', () => {
  let token

  beforeAll(async () => {
    const { signAccessTokenAsync } = require('../../../src/lib/@system/Helpers/jwt')
    token = await signAccessTokenAsync({ sub: 1, role: 'admin' })
  })

  it('returns 200 with healthy status when all deps are up', async () => {
    const res = await request(app)
      .get('/api/health-check/dependencies')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('healthy')
    expect(res.body.timestamp).toBeDefined()
    expect(res.body.uptime).toBeDefined()
    expect(res.body.dependencies).toBeInstanceOf(Array)
    expect(res.body.dependencies.length).toBeGreaterThanOrEqual(1)
    expect(res.body.summary).toBeDefined()
    expect(res.body.summary.total).toBeDefined()
    expect(res.body.summary.healthy).toBeDefined()
    expect(res.body.summary.unhealthy).toBeDefined()
  })

  it('includes database dependency check', async () => {
    const res = await request(app)
      .get('/api/health-check/dependencies')
      .set('Authorization', `Bearer ${token}`)

    const dbDep = res.body.dependencies.find((d) => d.name === 'database')
    expect(dbDep).toBeDefined()
    expect(dbDep.status).toBe('healthy')
    expect(typeof dbDep.latency_ms).toBe('number')
  })

  it('includes redis dependency check', async () => {
    const res = await request(app)
      .get('/api/health-check/dependencies')
      .set('Authorization', `Bearer ${token}`)

    const redisDep = res.body.dependencies.find((d) => d.name === 'redis')
    expect(redisDep).toBeDefined()
    expect(typeof redisDep.latency_ms).toBe('number')
  })

  it('includes auth dependency check', async () => {
    const res = await request(app)
      .get('/api/health-check/dependencies')
      .set('Authorization', `Bearer ${token}`)

    const authDep = res.body.dependencies.find((d) => d.name === 'auth')
    expect(authDep).toBeDefined()
    expect(authDep.status).toBe('healthy')
  })

  it('reports degraded when database is down', async () => {
    db.one.mockRejectedValue(new Error('Connection refused'))

    const res = await request(app)
      .get('/api/health-check/dependencies')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const dbDep = res.body.dependencies.find((d) => d.name === 'database')
    expect(dbDep.status).toBe('unhealthy')
    expect(dbDep.error).toMatch(/Connection refused/)
    expect(res.body.summary.unhealthy).toBeGreaterThanOrEqual(1)
  })

  it('reports degraded when redis is not ready', async () => {
    Redis.isReady.mockReturnValue(false)

    const res = await request(app)
      .get('/api/health-check/dependencies')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const redisDep = res.body.dependencies.find((d) => d.name === 'redis')
    expect(redisDep.status).toBe('unhealthy')
    expect(redisDep.error).toBeDefined()
  })

  it('summary counts match dependency statuses', async () => {
    const res = await request(app)
      .get('/api/health-check/dependencies')
      .set('Authorization', `Bearer ${token}`)

    const { summary, dependencies } = res.body
    expect(summary.total).toBe(dependencies.length)
    const h = dependencies.filter((d) => d.status === 'healthy').length
    const u = dependencies.filter((d) => d.status === 'unhealthy').length
    expect(summary.healthy).toBe(h)
    expect(summary.unhealthy).toBe(u)
    expect(h + u).toBe(summary.total)
  })

  it('each dependency has required fields', async () => {
    const res = await request(app)
      .get('/api/health-check/dependencies')
      .set('Authorization', `Bearer ${token}`)

    for (const dep of res.body.dependencies) {
      expect(dep.name).toBeDefined()
      expect(typeof dep.name).toBe('string')
      expect(['healthy', 'unhealthy']).toContain(dep.status)
      expect(typeof dep.latency_ms).toBe('number')
      expect(dep.latency_ms).toBeGreaterThanOrEqual(0)
    }
  })
})
