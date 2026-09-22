/**
 * Integration tests for auth flows against a real Express app + Postgres.
 *
 * These tests require a running PostgreSQL instance (provided by CI's
 * postgres service container, or a local dev DB).
 *
 * Set DATABASE_URL to point at the test database.
 * If DATABASE_URL is not set, these tests are skipped gracefully.
 */

const request = require('supertest')

const hasDb = Boolean(process.env.DATABASE_URL)
const describeIf = hasDb ? describe : describe.skip

// Only load the app when a real DB is available — require-time side effects
// (pg-promise connection) would throw otherwise.
let app
if (hasDb) {
  // Generate JWT keys so the app can sign/verify tokens.
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

// Unique email per test run to avoid collisions in shared test DB.
const testEmail = `integ-${Date.now()}@test.local`
const testPassword = 'IntegTest!123'

describeIf('Auth integration (real DB)', () => {
  // ── Health check ───────────────────────────────────────────────────────
  describe('GET /api/health', () => {
    it('returns 200 with db: connected', async () => {
      const res = await request(app).get('/api/health')
      expect(res.status).toBe(200)
      expect(res.body.status).toMatch(/ok|degraded/)
      expect(res.body.db).toBe('connected')
    })
  })

  // ── Signup ─────────────────────────────────────────────────────────────
  describe('POST /api/auth/register', () => {
    it('creates a new user and returns 201 with auth cookies', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: testEmail, password: testPassword, name: 'Integ Test' })

      expect(res.status).toBe(201)
      expect(res.body.user).toBeDefined()
      expect(res.body.user.email).toBe(testEmail)

      const cookies = res.headers['set-cookie']
      expect(cookies).toBeDefined()
      const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : cookies
      expect(cookieStr).toMatch(/access_token/)
      expect(cookieStr).toMatch(/refresh_token/)
    })

    it('returns 409 for duplicate email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: testEmail, password: testPassword, name: 'Dup' })

      expect(res.status).toBe(409)
    })

    it('returns 400 for missing email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ password: testPassword })

      expect(res.status).toBe(400)
    })

    it('returns 400 for short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: `short-${Date.now()}@test.local`, password: 'abc' })

      expect(res.status).toBe(400)
    })
  })

  // ── Login ──────────────────────────────────────────────────────────────
  describe('POST /api/sessions (login)', () => {
    it('returns 200 with valid credentials', async () => {
      const res = await request(app)
        .post('/api/sessions')
        .send({ email: testEmail, password: testPassword })

      expect(res.status).toBe(200)
      expect(res.body.user).toBeDefined()
      expect(res.body.user.email).toBe(testEmail)
    })

    it('returns 401 with wrong password', async () => {
      const res = await request(app)
        .post('/api/sessions')
        .send({ email: testEmail, password: 'WrongPass999' })

      expect(res.status).toBe(401)
    })

    it('returns 401 for non-existent user', async () => {
      const res = await request(app)
        .post('/api/sessions')
        .send({ email: 'nobody@test.local', password: testPassword })

      expect(res.status).toBe(401)
    })
  })

  // ── Logout ─────────────────────────────────────────────────────────────
  describe('DELETE /api/sessions (logout)', () => {
    it('clears auth cookies', async () => {
      // Login first
      const loginRes = await request(app)
        .post('/api/sessions')
        .send({ email: testEmail, password: testPassword })

      const loginCookies = loginRes.headers['set-cookie']

      // Logout
      const res = await request(app)
        .delete('/api/sessions')
        .set('Cookie', loginCookies)

      expect(res.status).toBe(200)
      expect(res.body.message).toMatch(/logged out/i)
    })
  })

  // ── Password reset flow (structural) ──────────────────────────────────
  describe('POST /api/auth/forgot-password', () => {
    it('returns 200 regardless of email existence (no enumeration)', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testEmail })

      expect(res.status).toBe(200)
    })

    it('returns 200 for unknown email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'unknown@test.local' })

      expect(res.status).toBe(200)
    })
  })
})
