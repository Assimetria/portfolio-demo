/**
 * Integration tests for @custom API endpoints against a real Express app.
 *
 * Covers:
 *   - GET /api/dashboard  (auth required)
 *   - GET /api/billing    (auth required)
 *   - GET /api/settings   (auth required)
 *   - GET /api/admin      (auth + admin required)
 *
 * These endpoints power the primary in-app views. Full auth-round-trip
 * coverage requires DATABASE_URL; without it the test file is skipped
 * gracefully so unit CI stays green.
 */

const request = require('supertest')

const hasDb = Boolean(process.env.DATABASE_URL)
const describeIf = hasDb ? describe : describe.skip

let app
if (hasDb) {
  const crypto = require('crypto')
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  process.env.JWT_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n')
  process.env.JWT_PUBLIC_KEY = publicKey.replace(/\n/g, '\\n')

  app = require('../../src/app')
}

const testEmail = `custom-integ-${Date.now()}@test.local`
const testPassword = 'IntegTest!123'

describeIf('Custom API endpoints (real DB)', () => {
  let authCookies

  // Register + log a user in, then reuse the cookies across the endpoint tests.
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: testEmail, password: testPassword, name: 'Custom Integ' })

    if (res.status === 201) {
      authCookies = res.headers['set-cookie']
    } else {
      // Fallback: user already exists, log in instead.
      const login = await request(app)
        .post('/api/sessions')
        .send({ email: testEmail, password: testPassword })
      authCookies = login.headers['set-cookie']
    }
  })

  // ── /api/dashboard ─────────────────────────────────────────────────────
  describe('GET /api/dashboard', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/dashboard')
      expect(res.status).toBe(401)
    })

    it('returns 200 with a valid session', async () => {
      const res = await request(app)
        .get('/api/dashboard')
        .set('Cookie', authCookies)

      expect(res.status).toBe(200)
      expect(res.body.user).toBeDefined()
      expect(res.body.user.email).toBe(testEmail)
      expect(res.body.user.id).toBeDefined()
    })
  })

  // ── /api/billing ───────────────────────────────────────────────────────
  describe('GET /api/billing', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/billing')
      expect(res.status).toBe(401)
    })

    it('returns 200 with billing summary shape when authenticated', async () => {
      const res = await request(app)
        .get('/api/billing')
        .set('Cookie', authCookies)

      expect(res.status).toBe(200)
      expect(res.body.user_id).toBeDefined()
      expect(res.body).toHaveProperty('subscription')
    })
  })

  // ── /api/settings ──────────────────────────────────────────────────────
  describe('GET /api/settings', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/settings')
      expect(res.status).toBe(401)
    })

    it('returns 200 with settings shape when authenticated', async () => {
      const res = await request(app)
        .get('/api/settings')
        .set('Cookie', authCookies)

      expect(res.status).toBe(200)
      expect(res.body.user_id).toBeDefined()
      expect(res.body.settings).toBeDefined()
      expect(typeof res.body.settings).toBe('object')
    })
  })

  // ── /api/admin ─────────────────────────────────────────────────────────
  describe('GET /api/admin', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/admin')
      expect(res.status).toBe(401)
    })

    it('returns 403 for a non-admin authenticated user', async () => {
      const res = await request(app)
        .get('/api/admin')
        .set('Cookie', authCookies)

      // Fresh users are non-admin by default — requireAdmin should reject.
      expect([401, 403]).toContain(res.status)
    })
  })
})
