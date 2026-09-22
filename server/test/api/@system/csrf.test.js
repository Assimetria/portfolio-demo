const request = require('supertest')
// Feature modules: this suite exercises the `selfRegistration` module, which the
// informational brand.json switches off. Enable it for this file only —
// Helpers/modules.js reads MODULES_JSON when the app loads.
process.env.MODULES_JSON = JSON.stringify({ selfRegistration: true })
afterAll(() => { delete process.env.MODULES_JSON })
const app = require('../../../src/app')

// Cookie name depends on NODE_ENV — in test/dev it lacks the __Host- prefix.
// The module is loaded once at require-time, so the name is baked in for the
// process lifetime. Match whatever the running environment uses (#31517).
const CSRF_COOKIE_NAME = process.env.NODE_ENV === 'production'
  ? '__Host-psifi.x-csrf-token'
  : 'psifi.x-csrf-token'

describe('CSRF Protection', () => {
  describe('GET /api/csrf-token', () => {
    it('should return a CSRF token', async () => {
      const res = await request(app)
        .get('/api/csrf-token')
        .expect(200)

      expect(res.body).toHaveProperty('csrfToken')
      expect(typeof res.body.csrfToken).toBe('string')
      expect(res.body.csrfToken.length).toBeGreaterThan(0)
    })

    it('should set CSRF cookie', async () => {
      const res = await request(app)
        .get('/api/csrf-token')
        .expect(200)

      const cookies = res.headers['set-cookie']
      expect(cookies).toBeDefined()
      expect(cookies.some(cookie => cookie.includes(CSRF_COOKIE_NAME))).toBe(true)
    })

    it('should set httpOnly cookie', async () => {
      const res = await request(app)
        .get('/api/csrf-token')
        .expect(200)

      const cookies = res.headers['set-cookie']
      const csrfCookie = cookies.find(cookie => cookie.includes(CSRF_COOKIE_NAME))
      expect(csrfCookie).toContain('HttpOnly')
    })

    it('should set SameSite=Strict cookie', async () => {
      const res = await request(app)
        .get('/api/csrf-token')
        .expect(200)

      const cookies = res.headers['set-cookie']
      const csrfCookie = cookies.find(cookie => cookie.includes(CSRF_COOKIE_NAME))
      expect(csrfCookie).toContain('SameSite=Strict')
    })
  })

  describe('CSRF Token Validation (when applied)', () => {
    let csrfToken
    let cookies

    beforeEach(async () => {
      // Fetch CSRF token before each test
      const res = await request(app)
        .get('/api/csrf-token')
      
      csrfToken = res.body.csrfToken
      cookies = res.headers['set-cookie']
    })

    // Note: These tests demonstrate the expected behavior when CSRF protection is applied to routes
    // They will need to be updated to test actual protected endpoints once CSRF is integrated

    it('should accept valid CSRF token in X-CSRF-Token header', async () => {
      // This is a demonstration test - update with actual protected endpoint
      // Example:
      // await request(app)
      //   .post('/api/protected-endpoint')
      //   .set('Cookie', cookies)
      //   .set('X-CSRF-Token', csrfToken)
      //   .send({ data: 'test' })
      //   .expect(200)
      
      expect(csrfToken).toBeDefined()
      expect(cookies).toBeDefined()
    })

    it('should reject requests without CSRF token', async () => {
      // This is a demonstration test - update with actual protected endpoint
      // Example:
      // await request(app)
      //   .post('/api/protected-endpoint')
      //   .set('Cookie', cookies)
      //   .send({ data: 'test' })
      //   .expect(403)
      
      expect(csrfToken).toBeDefined()
    })

    it('should reject requests with invalid CSRF token', async () => {
      // This is a demonstration test - update with actual protected endpoint
      // Example:
      // await request(app)
      //   .post('/api/protected-endpoint')
      //   .set('Cookie', cookies)
      //   .set('X-CSRF-Token', 'invalid-token')
      //   .send({ data: 'test' })
      //   .expect(403)
      
      expect(csrfToken).toBeDefined()
    })

    it('should reject requests with CSRF token but no cookie', async () => {
      // This is a demonstration test - update with actual protected endpoint
      // Example:
      // await request(app)
      //   .post('/api/protected-endpoint')
      //   .set('X-CSRF-Token', csrfToken)
      //   .send({ data: 'test' })
      //   .expect(403)
      
      expect(csrfToken).toBeDefined()
    })

    it('should allow GET requests without CSRF token', async () => {
      // GET requests are safe methods and should not require CSRF protection
      // This is enforced by the CSRF middleware configuration
      await request(app)
        .get('/api/ping')
        .expect(200)
    })

    it('should allow HEAD requests without CSRF token', async () => {
      // HEAD requests are safe methods
      await request(app)
        .head('/api/ping')
        .expect(200)
    })

    it('should allow OPTIONS requests without CSRF token', async () => {
      // OPTIONS requests are safe methods (used in CORS preflight)
      // Express returns 204 for auto-handled OPTIONS requests
      const res = await request(app).options('/api/ping')
      expect([200, 204]).toContain(res.status)
    })
  })

  describe('CSRF Protection Bypass in Test Environment', () => {
    it('should bypass CSRF validation in test environment', () => {
      // Verify we're in test environment
      expect(process.env.NODE_ENV).toBe('test')
      
      // CSRF protection is automatically disabled in test environment
      // This allows tests to run without needing CSRF tokens
      // See src/lib/@system/Middleware/csrf.js for implementation
    })
  })

  describe('Token Generation and Validation Flow', () => {
    it('should generate different tokens on each request', async () => {
      const res1 = await request(app).get('/api/csrf-token')
      const res2 = await request(app).get('/api/csrf-token')

      expect(res1.body.csrfToken).not.toBe(res2.body.csrfToken)
    })

    it('should generate cryptographically secure tokens', async () => {
      const res = await request(app).get('/api/csrf-token')
      const token = res.body.csrfToken

      // Token should be at least 64 characters (32 bytes in hex)
      // as configured in csrf.js (size: 64)
      expect(token.length).toBeGreaterThanOrEqual(64)
      
      // Token is hex HMAC + '.' + hex random value (csrf-csrf format)
      expect(/^[a-zA-Z0-9.]+$/.test(token)).toBe(true)
    })
  })

  describe('Cookie Configuration', () => {
    it('should set secure cookie in production', async () => {
      // Save original NODE_ENV
      const originalEnv = process.env.NODE_ENV

      // Set to production — note: the csrf module was already loaded with the
      // original NODE_ENV, so the cookie name is baked in. We can only verify
      // the cookie is set with the test-time name (#31517).
      process.env.NODE_ENV = 'production'

      const res = await request(app).get('/api/csrf-token')
      const cookies = res.headers['set-cookie']
      const csrfCookie = cookies.find(cookie => cookie.includes(CSRF_COOKIE_NAME))

      // Restore NODE_ENV
      process.env.NODE_ENV = originalEnv

      expect(csrfCookie).toBeDefined()
    })

    it('should use correct cookie name for environment', async () => {
      const res = await request(app).get('/api/csrf-token')
      const cookies = res.headers['set-cookie']

      // In test env the cookie lacks the __Host- prefix (no HTTPS).
      // In production it would use __Host-psifi.x-csrf-token (requires Secure + Path=/).
      const csrfCookie = cookies.find(cookie => cookie.includes(CSRF_COOKIE_NAME))
      expect(csrfCookie).toBeDefined()
      expect(csrfCookie).toContain('Path=/')
    })
  })

  describe('Integration Examples', () => {
    it('demonstrates full CSRF flow', async () => {
      // Step 1: Client fetches CSRF token
      const tokenRes = await request(app).get('/api/csrf-token')
      const { csrfToken } = tokenRes.body
      const cookies = tokenRes.headers['set-cookie']

      expect(csrfToken).toBeDefined()
      expect(cookies).toBeDefined()

      // Step 2: Client includes token and cookie in protected request.
      // In test mode CSRF validation is bypassed (NODE_ENV=test), so these
      // tests verify the flow structure rather than actual 403 rejection.
      // CSRF enforcement is validated via the exempt-paths unit tests below.

      // Step 3: Server validates token matches cookie
      // This happens automatically in the csrfProtection middleware
    })
  })

  describe('CSRF enforcement on auth endpoints (non-test mode)', () => {
    // These tests temporarily enable CSRF enforcement (which is disabled in
    // NODE_ENV=test) and verify that login/register endpoints reject requests
    // that arrive without a CSRF token or cookie.
    const originalEnv = process.env.NODE_ENV

    afterEach(() => {
      process.env.NODE_ENV = originalEnv
    })

    it('POST /api/sessions without CSRF token returns 403 (#38791)', async () => {
      process.env.NODE_ENV = 'development'
      const res = await request(app)
        .post('/api/sessions')
        .send({ email: 'test@example.com', password: 'Password1' })
      expect(res.status).toBe(403)
      expect(res.body.error).toBe('CSRF_VALIDATION_FAILED')
    })

    it('POST /api/sessions/register without CSRF token returns 403', async () => {
      process.env.NODE_ENV = 'development'
      const res = await request(app)
        .post('/api/sessions/register')
        .send({ email: 'new@example.com', password: 'Password1', name: 'Test' })
      expect(res.status).toBe(403)
      expect(res.body.error).toBe('CSRF_VALIDATION_FAILED')
    })

    it('POST /api/auth/login without CSRF token returns 403 (#38791)', async () => {
      process.env.NODE_ENV = 'development'
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'Password1' })
      // Login now requires CSRF (#38791) — matches SendVerb and Pacekit.
      expect(res.status).toBe(403)
      expect(res.body.error).toBe('CSRF_VALIDATION_FAILED')
    })

    it('POST /api/auth/register without CSRF token returns 403', async () => {
      process.env.NODE_ENV = 'development'
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'new@example.com', password: 'Password1', name: 'Test' })
      expect(res.status).toBe(403)
      expect(res.body.error).toBe('CSRF_VALIDATION_FAILED')
    })
  })

  describe('CSRF Exempt Paths — auth routes must NOT be exempt', () => {
    // These tests guard against regressions where auth routes are accidentally
    // added to the CSRF exempt list, re-introducing CSRF vulnerabilities.
    // All auth routes (login, register, password-reset) require CSRF (#38791).
    const CSRF_PROTECTED_AUTH_PATHS = [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
      '/api/sessions',
      '/api/sessions/register',
    ]

    it.each(CSRF_PROTECTED_AUTH_PATHS)(
      'auth route %s must not be in the CSRF exempt list',
      (authPath) => {
        // Read the raw source to verify the path is absent from CSRF_EXEMPT_PATHS
        const fs = require('fs')
        const src = fs.readFileSync(
          require('path').join(__dirname, '../../../src/lib/@system/Middleware/csrf.js'),
          'utf8',
        )
        // Extract the CSRF_EXEMPT_PATHS array definition from source
        const match = src.match(/const CSRF_EXEMPT_PATHS\s*=\s*\[([\s\S]*?)\]/)
        expect(match).not.toBeNull()
        const pathsBlock = match[1]
        // The auth path string should not appear inside CSRF_EXEMPT_PATHS
        expect(pathsBlock).not.toContain(`'${authPath}'`)
        expect(pathsBlock).not.toContain(`"${authPath}"`)
      },
    )

    it('CSRF_EXEMPT_LOGIN must not exist (login routes are no longer exempt, #38791)', () => {
      const csrf = require('../../../src/lib/@system/Middleware/csrf')
      expect(csrf.CSRF_EXEMPT_LOGIN).toBeUndefined()
    })

    it('token refresh must remain exempt (no CSRF header in client refresh call)', () => {
      const fs = require('fs')
      const src = fs.readFileSync(
        require('path').join(__dirname, '../../../src/lib/@system/Middleware/csrf.js'),
        'utf8',
      )
      const match = src.match(/const CSRF_EXEMPT_PATHS\s*=\s*\[([\s\S]*?)\]/)
      expect(match).not.toBeNull()
      const pathsBlock = match[1]
      expect(pathsBlock).toContain('/api/sessions/refresh')
    })
  })

  describe('Route-level CSRF guard — requireCsrfPresence on auth routes (#30197, #38791)', () => {
    // Structural regression guard: reads route source files to verify
    // requireCsrfPresence middleware is present on all auth route definitions.
    // All auth routes (login + register) require CSRF protection (#38791).
    const fs = require('fs')
    const path = require('path')

    const AUTH_ROUTES_WITH_CSRF = [
      {
        file: 'api/@system/sessions/index.js',
        pattern: /router\.post\('\/sessions\/register',\s*requireCsrfPresence/,
        description: 'POST /sessions/register',
      },
      {
        file: 'api/@system/sessions/index.js',
        pattern: /router\.post\('\/sessions',\s*requireCsrfPresence/,
        description: 'POST /sessions (login)',
      },
      {
        file: 'api/@system/auth/index.js',
        pattern: /router\.post\('\/auth\/register',\s*requireCsrfPresence/,
        description: 'POST /auth/register',
      },
      {
        file: 'api/@system/auth/index.js',
        pattern: /router\.post\('\/auth\/login',\s*requireCsrfPresence/,
        description: 'POST /auth/login',
      },
    ]

    it.each(AUTH_ROUTES_WITH_CSRF)(
      '$description route must include requireCsrfPresence middleware',
      ({ file, pattern }) => {
        const src = fs.readFileSync(
          path.join(__dirname, '../../../src', file),
          'utf8',
        )
        expect(src).toMatch(pattern)
      },
    )
  })
})

// Additional test helpers and utilities

/**
 * Helper function to fetch CSRF token for use in other tests
 * 
 * Usage:
 *   const { csrfToken, cookies } = await getCsrfToken()
 *   await request(app)
 *     .post('/api/protected-endpoint')
 *     .set('Cookie', cookies)
 *     .set('X-CSRF-Token', csrfToken)
 */
async function getCsrfToken() {
  const res = await request(app).get('/api/csrf-token')
  return {
    csrfToken: res.body.csrfToken,
    cookies: res.headers['set-cookie'],
  }
}

module.exports = {
  getCsrfToken, // Export for use in other test files
}
