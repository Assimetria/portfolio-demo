/**
 * API tests for GET/PUT /api/comments-alerting/config (@custom)
 *
 * External deps (DB, Redis, Email) are mocked so the suite runs in CI
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

const jwt = require('jsonwebtoken')

const USER = { id: 1, email: 'user@example.com', name: 'Test User', role: 'user' }

function signTestToken(user) {
  return jwt.sign({ userId: user.id, sub: String(user.id), email: user.email, name: user.name, role: user.role }, privateKey, { algorithm: 'RS256', expiresIn: '15m' })
}

describe('GET /api/comments-alerting/config', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/comments-alerting/config')
    expect(res.status).toBe(401)
  })

  it('returns 401 with an invalid bearer token', async () => {
    const res = await request(app)
      .get('/api/comments-alerting/config')
      .set('Authorization', 'Bearer invalid.token.here')
    expect(res.status).toBe(401)
  })

  it('returns JSON content-type on the unauthorized response', async () => {
    const res = await request(app).get('/api/comments-alerting/config')
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })

  it('returns alerting config with expected shape when authenticated', async () => {
    const res = await request(app)
      .get('/api/comments-alerting/config')
      .set('Authorization', `Bearer ${signTestToken(USER)}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('config')
    expect(res.body.config).toHaveProperty('enabled')
    expect(res.body.config).toHaveProperty('slack_webhook_url')
    expect(res.body.config).toHaveProperty('email_notifications')
    expect(res.body.config).toHaveProperty('error_threshold')
    expect(res.body.config).toHaveProperty('time_window_minutes')
    expect(res.body.config).toHaveProperty('notify_on')
    expect(res.body.config).toHaveProperty('quiet_hours_enabled')
  })

  it('rejects POST method (only GET is defined for config)', async () => {
    const res = await request(app).post('/api/comments-alerting/config')
    expect([401, 404]).toContain(res.status)
  })
})

describe('PUT /api/comments-alerting/config', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).put('/api/comments-alerting/config')
    expect(res.status).toBe(401)
  })

  it('updates config fields when authenticated', async () => {
    const res = await request(app)
      .put('/api/comments-alerting/config')
      .set('Authorization', `Bearer ${signTestToken(USER)}`)
      .send({
        enabled: false,
        error_threshold: 25,
        slack_webhook_url: 'https://hooks.slack.com/services/test',
      })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('config')
    expect(res.body.config.enabled).toBe(false)
    expect(res.body.config.error_threshold).toBe(25)
    expect(res.body.config.slack_webhook_url).toBe('https://hooks.slack.com/services/test')
    expect(res.body).toHaveProperty('message', 'Alerting configuration updated successfully')
  })

  it('preserves existing fields when partial update is sent', async () => {
    const res = await request(app)
      .put('/api/comments-alerting/config')
      .set('Authorization', `Bearer ${signTestToken(USER)}`)
      .send({ email_notifications: false })
    expect(res.status).toBe(200)
    expect(res.body.config.email_notifications).toBe(false)
    expect(res.body.config.enabled).toBeDefined()
    expect(res.body.config.error_threshold).toBeDefined()
  })

  it('rejects DELETE method (only PUT is defined for config)', async () => {
    const res = await request(app).delete('/api/comments-alerting/config')
    expect([401, 404]).toContain(res.status)
  })
})

describe('POST /api/comments-alerting/test', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).post('/api/comments-alerting/test')
    expect(res.status).toBe(401)
  })

  it('returns success message when authenticated', async () => {
    const res = await request(app)
      .post('/api/comments-alerting/test')
      .set('Authorization', `Bearer ${signTestToken(USER)}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('message', 'Test alert sent successfully')
    expect(res.body).toHaveProperty('timestamp')
  })
})
