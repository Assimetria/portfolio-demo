/**
 * API tests for /api/compliance/* (@custom, task #1062103)
 *
 *   GET /api/compliance/status          — authenticate + requireAdmin
 *   GET /api/compliance/infrastructure  — authenticate + requireAdmin
 *   GET /api/compliance/legal           — public
 *
 * The router is mounted directly (like test/unit/@custom/todos-example.route.test.js)
 * so the auth middleware can be swapped per test. DB is mocked — no Postgres needed.
 */

const request = require('supertest')
const express = require('express')

jest.mock('../../../src/lib/@system/PostgreSQL', () => ({
  one: jest.fn(),
  oneOrNone: jest.fn(),
  none: jest.fn(),
  any: jest.fn(),
}))

// Default: unauthenticated. Individual tests set `mockAuth.user` to simulate a session.
const mockAuth = { user: null }
jest.mock('../../../src/lib/@system/Helpers/auth', () => ({
  authenticate: (req, res, next) => {
    if (!mockAuth.user) return res.status(401).json({ message: 'Authentication required' })
    req.user = mockAuth.user
    next()
  },
  requireAdmin: (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You need admin privileges to access this area.' })
    }
    next()
  },
  requireOwnerOrAdmin: () => (_req, _res, next) => next(),
  requirePlan: () => (_req, _res, next) => next(),
  requireApiKeyScope: () => (_req, _res, next) => next(),
  PLAN_TIERS: {},
}))

const db = require('../../../src/lib/@system/PostgreSQL')
const router = require('../../../src/api/@custom/compliance')

function buildApp() {
  const app = express()
  app.use('/api', router)
  app.use((_req, res) => res.status(404).json({ message: 'Not found' }))
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ message: err.message }))
  return app
}

function healthyDb() {
  db.one.mockImplementation(async (sql) => {
    if (/schema_migrations/.test(sql)) return { count: 34 }
    return { '?column?': 1 }
  })
  db.oneOrNone.mockResolvedValue({ name: 'gdpr_consent_log' })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAuth.user = null
  healthyDb()
})

// ── auth guards ───────────────────────────────────────────────────────────────

describe('auth guards', () => {
  it('GET /api/compliance/status returns 401 without authentication', async () => {
    const res = await request(buildApp()).get('/api/compliance/status')
    expect(res.status).toBe(401)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    expect(res.body).not.toHaveProperty('infrastructure')
  })

  it('GET /api/compliance/status returns 403 for a non-admin user', async () => {
    mockAuth.user = { id: 7, role: 'user' }
    const res = await request(buildApp()).get('/api/compliance/status')
    expect(res.status).toBe(403)
  })

  it('GET /api/compliance/infrastructure returns 401 without authentication', async () => {
    const res = await request(buildApp()).get('/api/compliance/infrastructure')
    expect(res.status).toBe(401)
  })

  it('GET /api/compliance/infrastructure returns 403 for a non-admin user', async () => {
    mockAuth.user = { id: 7, role: 'user' }
    const res = await request(buildApp()).get('/api/compliance/infrastructure')
    expect(res.status).toBe(403)
  })

  it('rejects POST on every compliance path', async () => {
    const app = buildApp()
    for (const p of ['/api/compliance/status', '/api/compliance/infrastructure', '/api/compliance/legal']) {
      const res = await request(app).post(p)
      expect(res.status).toBe(404)
    }
  })
})

// ── GET /api/compliance/status ────────────────────────────────────────────────

describe('GET /api/compliance/status (admin)', () => {
  beforeEach(() => {
    mockAuth.user = { id: 1, role: 'admin' }
  })

  it('returns the combined report with the exact top-level shape', async () => {
    const res = await request(buildApp()).get('/api/compliance/status')
    expect(res.status).toBe(200)
    expect(Object.keys(res.body).sort()).toEqual(
      ['infrastructure', 'legal', 'lifecycle', 'status', 'timestamp'].sort()
    )
    expect(['compliant', 'non_compliant']).toContain(res.body.status)
    expect(typeof res.body.lifecycle).toBe('string')
    expect(new Date(res.body.timestamp).toString()).not.toBe('Invalid Date')
  })

  it('reports lifecycle from APP_LIFECYCLE when set', async () => {
    process.env.APP_LIFECYCLE = 'live'
    try {
      const res = await request(buildApp()).get('/api/compliance/status')
      expect(res.body.lifecycle).toBe('live')
    } finally {
      delete process.env.APP_LIFECYCLE
    }
  })

  it('is compliant when DB, migrations, legal pages and consent log are all present (non-prod)', async () => {
    process.env.APP_URL = 'http://localhost:3000'
    const res = await request(buildApp()).get('/api/compliance/status')
    expect(res.status).toBe(200)
    expect(res.body.infrastructure.status).toBe('compliant')
    expect(res.body.infrastructure.failed).toEqual([])
    expect(res.body.legal.status).toBe('compliant')
    expect(res.body.legal.failed).toEqual([])
    expect(res.body.status).toBe('compliant')
  })

  it('flips to non_compliant when the database is unreachable', async () => {
    db.one.mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }))
    const res = await request(buildApp()).get('/api/compliance/status')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('non_compliant')
    expect(res.body.infrastructure.checks.database).toMatchObject({
      ok: false,
      required: true,
      state: 'disconnected',
      error: 'ECONNREFUSED',
    })
    expect(res.body.infrastructure.checks.migrations).toMatchObject({ ok: false, error: 'database_unavailable' })
    expect(res.body.infrastructure.failed).toEqual(expect.arrayContaining(['database', 'migrations']))
  })

  it('never echoes secret values', async () => {
    process.env.SENTRY_DSN = 'https://abc123@o1.ingest.sentry.io/1'
    process.env.CSRF_SECRET = 'super-secret-csrf'
    try {
      const res = await request(buildApp()).get('/api/compliance/status')
      const body = JSON.stringify(res.body)
      expect(body).not.toContain('abc123')
      expect(body).not.toContain('super-secret-csrf')
      expect(res.body.infrastructure.checks.errorTracking.state).toBe('configured')
    } finally {
      delete process.env.SENTRY_DSN
      delete process.env.CSRF_SECRET
    }
  })
})

// ── GET /api/compliance/infrastructure ────────────────────────────────────────

describe('GET /api/compliance/infrastructure (admin)', () => {
  beforeEach(() => {
    mockAuth.user = { id: 1, role: 'admin' }
  })

  it('lists every infrastructure check with ok/required flags', async () => {
    const res = await request(buildApp()).get('/api/compliance/infrastructure')
    expect(res.status).toBe(200)
    expect(Object.keys(res.body.checks).sort()).toEqual(
      ['appUrl', 'backups', 'database', 'email', 'errorTracking', 'migrations', 'redis', 'secrets', 'version'].sort()
    )
    for (const check of Object.values(res.body.checks)) {
      expect(typeof check.ok).toBe('boolean')
      expect(typeof check.required).toBe('boolean')
    }
    expect(res.body.checks.database).toEqual({ ok: true, required: true, state: 'connected' })
    expect(res.body.checks.migrations).toEqual({ ok: true, required: true, applied: 34 })
    expect(db.one).toHaveBeenCalledWith('SELECT 1')
    expect(db.one).toHaveBeenCalledWith('SELECT COUNT(*)::int AS count FROM schema_migrations')
  })

  it('exposes the documented backup policy (RPO/RTO from docs/RUNBOOK.md §15)', async () => {
    const res = await request(buildApp()).get('/api/compliance/infrastructure')
    expect(res.body.checks.backups).toMatchObject({
      ok: true,
      required: true,
      state: 'documented',
      policy: {
        rpoHours: 24,
        rpoMinutesWithPitr: 5,
        rtoApplicationMinutes: 15,
        rtoDatabaseMinutes: 60,
      },
    })
  })

  it('reports missing error tracking and console-only email as recommended (not required) outside production', async () => {
    for (const k of ['SENTRY_DSN', 'ERROR_TRACKING_DSN', 'EMAIL_PROVIDER', 'RESEND_API_KEY', 'SMTP_HOST', 'AWS_ACCESS_KEY_ID']) {
      delete process.env[k]
    }
    const res = await request(buildApp()).get('/api/compliance/infrastructure')
    expect(res.body.checks.errorTracking).toMatchObject({ ok: false, required: false, state: 'missing' })
    expect(res.body.checks.email).toMatchObject({ ok: false, required: false, provider: 'console' })
    expect(res.body.status).toBe('compliant')
  })

  it('detects the email transport from env the same way lib/@system/Email does', async () => {
    process.env.SMTP_HOST = 'smtp.resend.com'
    try {
      const res = await request(buildApp()).get('/api/compliance/infrastructure')
      expect(res.body.checks.email).toMatchObject({ ok: true, provider: 'smtp', state: 'configured' })
    } finally {
      delete process.env.SMTP_HOST
    }
  })

  it('flags a missing APP_URL as a required failure', async () => {
    const prev = process.env.APP_URL
    delete process.env.APP_URL
    try {
      const res = await request(buildApp()).get('/api/compliance/infrastructure')
      expect(res.body.checks.appUrl).toEqual({ ok: false, required: true, state: 'missing' })
      expect(res.body.status).toBe('non_compliant')
      expect(res.body.failed).toContain('appUrl')
    } finally {
      if (prev !== undefined) process.env.APP_URL = prev
    }
  })
})

// ── GET /api/compliance/legal ─────────────────────────────────────────────────

describe('GET /api/compliance/legal (public)', () => {
  it('is reachable without authentication', async () => {
    const res = await request(buildApp()).get('/api/compliance/legal')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })

  it('lists every legal check with ok/required flags', async () => {
    const res = await request(buildApp()).get('/api/compliance/legal')
    expect(Object.keys(res.body.checks).sort()).toEqual(
      ['cookieConsent', 'effectiveDate', 'gdprApi', 'legalPages', 'privacyContact', 'retention'].sort()
    )
    for (const check of Object.values(res.body.checks)) {
      expect(typeof check.ok).toBe('boolean')
      expect(typeof check.required).toBe('boolean')
    }
  })

  it('verifies /privacy, /terms and /cookies against the route manifest', async () => {
    const res = await request(buildApp()).get('/api/compliance/legal')
    const { legalPages } = res.body.checks
    expect(legalPages.source).toBe('route-manifest')
    expect(legalPages.pages.privacy).toEqual({ path: '/privacy', present: true, required: true })
    expect(legalPages.pages.terms).toEqual({ path: '/terms', present: true, required: true })
    expect(legalPages.pages.cookies).toEqual({ path: '/cookies', present: true, required: true })
    expect(legalPages.pages.dpa).toMatchObject({ path: '/dpa', required: false })
    expect(legalPages.ok).toBe(true)
  })

  it('reports the GDPR data-subject rights endpoints', async () => {
    const res = await request(buildApp()).get('/api/compliance/legal')
    expect(res.body.checks.gdprApi).toEqual({
      ok: true,
      required: true,
      endpoints: ['POST /api/gdpr/consent', 'GET /api/gdpr/my-data', 'DELETE /api/gdpr/my-data'],
    })
  })

  it('checks the gdpr_consent_log table exists', async () => {
    const res = await request(buildApp()).get('/api/compliance/legal')
    expect(db.oneOrNone).toHaveBeenCalledWith("SELECT to_regclass('gdpr_consent_log') AS name")
    expect(res.body.checks.cookieConsent).toEqual({ ok: true, required: true, state: 'consent_log_ready' })
  })

  it('marks cookie consent non-compliant when the consent log table is missing', async () => {
    db.oneOrNone.mockResolvedValue({ name: null })
    const res = await request(buildApp()).get('/api/compliance/legal')
    expect(res.body.checks.cookieConsent).toEqual({ ok: false, required: true, state: 'consent_log_missing' })
    expect(res.body.status).toBe('non_compliant')
    expect(res.body.failed).toEqual(['cookieConsent'])
  })

  it('reports retention windows (contact 180d default, audit logs from env or 90d)', async () => {
    process.env.AUDIT_LOG_RETENTION_DAYS = '120'
    try {
      const res = await request(buildApp()).get('/api/compliance/legal')
      expect(res.body.checks.retention).toEqual({
        ok: true,
        required: true,
        contactSubmissionsDays: 180,
        auditLogsDays: 120,
      })
    } finally {
      delete process.env.AUDIT_LOG_RETENTION_DAYS
    }
  })

  it('reports privacy contact presence without exposing the address', async () => {
    process.env.PRIVACY_CONTACT_EMAIL = 'privacy@creative-portfolio.example'
    try {
      const res = await request(buildApp()).get('/api/compliance/legal')
      expect(res.body.checks.privacyContact).toEqual({ ok: true, required: false, state: 'configured' })
      expect(JSON.stringify(res.body)).not.toContain('privacy@creative-portfolio.example')
    } finally {
      delete process.env.PRIVACY_CONTACT_EMAIL
    }
  })
})
