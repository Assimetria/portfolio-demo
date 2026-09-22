/**
 * API tests for GET /api/health (liveness) and GET /api/ready (readiness)
 *
 * Tests run without a real DB — DB is mocked so the suite is
 * fast, deterministic, and CI-friendly.
 */

const request = require('supertest')

// ── Mock PostgreSQL ────────────────────────────────────────────────────────
jest.mock('../../src/lib/@system/PostgreSQL', () => {
  const mockDb = {
    one: jest.fn(),
    oneOrNone: jest.fn(),
    none: jest.fn(),
    any: jest.fn(),
  }
  mockDb.connectPool = jest.fn().mockResolvedValue()
  mockDb.disconnectPool = jest.fn().mockResolvedValue()
  mockDb.pgp = {}
  mockDb.dbSource = 'test_mock'
  return mockDb
})

// ── Mock Redis ─────────────────────────────────────────────────────────────
jest.mock('../../src/lib/@system/Redis', () => ({
  client: {
    on: jest.fn(),
    status: 'ready',
  },
  connect: jest.fn().mockResolvedValue(),
  isReady: jest.fn().mockReturnValue(true),
}))

// ── Mock JWT helpers ───────────────────────────────────────────────────────
jest.mock('../../src/lib/@system/Helpers/jwt', () => ({
  signAccessTokenAsync: jest.fn().mockResolvedValue('mock-token'),
  verifyAccessTokenAsync: jest.fn().mockResolvedValue({ sub: 'health-probe' }),
}))

const app = require('../../src/app')
const db = require('../../src/lib/@system/PostgreSQL')

describe('GET /api/health', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default: healthy state
    db.one.mockResolvedValue({ '?column?': 1 })
    const jwt = require('../../src/lib/@system/Helpers/jwt')
    jwt.signAccessTokenAsync.mockResolvedValue('mock-token')
    jwt.verifyAccessTokenAsync.mockResolvedValue({ sub: 'health-probe' })
  })

  it('returns 200 with status ok when DB is healthy', async () => {
    const res = await request(app).get('/api/health')

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.database).toBe('connected')
    expect(res.body.db).toBe('connected')
    expect(res.body.auth).toBe('ok')
    expect(res.body.checks.server).toBe('ok')
    expect(res.body.checks.db).toBe('connected')
    expect(res.body.db_source).toBeDefined()
    expect(res.body.timestamp).toBeDefined()
    expect(res.body.version).toBeDefined()
    expect(res.body.uptime).toBeDefined()
    expect(res.body.checks).toBeDefined()
  })

  it('performs a SELECT 1 DB check', async () => {
    await request(app).get('/api/health')

    expect(db.one).toHaveBeenCalledWith('SELECT 1')
  })

  it('returns 200 with status degraded when DB is down', async () => {
    db.one.mockRejectedValue(new Error('Connection refused'))

    const res = await request(app).get('/api/health')

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('degraded')
    expect(res.body.db).toBe('disconnected')
    expect(res.body.checks.db).toBe('disconnected')
  })

  it('returns 200 with status degraded when auth is misconfigured', async () => {
    const jwt = require('../../src/lib/@system/Helpers/jwt')
    jwt.signAccessTokenAsync.mockRejectedValue(new Error('JWT keys not configured'))

    const res = await request(app).get('/api/health')

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('degraded')
    expect(res.body.auth).toBe('misconfigured')
    expect(res.body.checks.auth).toBe('misconfigured')
  })

  it('is available without authentication', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
  })

  it('returns JSON content-type', async () => {
    const res = await request(app).get('/api/health')
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })

  it('rejects PATCH method with 404', async () => {
    const res = await request(app).patch('/api/health')
    expect(res.status).toBe(404)
  })

  it('rejects POST method with 404', async () => {
    const res = await request(app).post('/api/health')
    expect(res.status).toBe(404)
  })

  it('rejects PUT method with 404', async () => {
    const res = await request(app).put('/api/health')
    expect(res.status).toBe(404)
  })

  it('rejects DELETE method with 404', async () => {
    const res = await request(app).delete('/api/health')
    expect(res.status).toBe(404)
  })

  it('is also served at the bare /health path', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})

describe('GET /api/ready (readiness)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    db.one.mockResolvedValue({ '?column?': 1 })
    const jwt = require('../../src/lib/@system/Helpers/jwt')
    jwt.signAccessTokenAsync.mockResolvedValue('mock-token')
    jwt.verifyAccessTokenAsync.mockResolvedValue({ sub: 'health-probe' })
  })

  it('returns 200 with ready: true when the DB answers', async () => {
    const res = await request(app).get('/api/ready')

    expect(res.status).toBe(200)
    expect(res.body.ready).toBe(true)
    expect(res.body.db).toBe('connected')
    expect(res.body.status).toBe('ok')
    expect(res.body.version).toBeDefined()
  })

  it('returns 503 with ready: false when the DB is down', async () => {
    db.one.mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }))

    const res = await request(app).get('/api/ready')

    expect(res.status).toBe(503)
    expect(res.body.ready).toBe(false)
    expect(res.body.db).toBe('disconnected')
    expect(res.body.status).toBe('degraded')
    expect(res.body.db_error).toBe('ECONNREFUSED')
  })

  it('stays 200 when only auth is misconfigured (readiness is a DB gate; auth is reported in the body)', async () => {
    const jwt = require('../../src/lib/@system/Helpers/jwt')
    jwt.signAccessTokenAsync.mockRejectedValue(new Error('JWT keys not configured'))

    const res = await request(app).get('/api/ready')

    expect(res.status).toBe(200)
    expect(res.body.ready).toBe(true)
    expect(res.body.auth).toBe('misconfigured')
    expect(res.body.status).toBe('degraded')
  })

  it('liveness keeps answering 200 while readiness reports 503', async () => {
    db.one.mockRejectedValue(new Error('Connection refused'))

    const [health, ready] = await Promise.all([
      request(app).get('/api/health'),
      request(app).get('/api/ready'),
    ])

    expect(health.status).toBe(200)
    expect(ready.status).toBe(503)
  })

  it('is also served at the bare /ready path', async () => {
    const res = await request(app).get('/ready')
    expect(res.status).toBe(200)
    expect(res.body.ready).toBe(true)
  })

  it('is available without authentication and returns JSON', async () => {
    const res = await request(app).get('/api/ready')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })

  it.each(['post', 'put', 'patch', 'delete'])('rejects %s with 404', async (method) => {
    const res = await request(app)[method]('/api/ready')
    expect(res.status).toBe(404)
  })
})
