/**
 * API tests — /api/contact (informational template).
 *
 * Runs against the real Express app with DB / Redis / Email mocked and
 * ContactRepo mocked at the module boundary so the tests assert the HTTP
 * contract (auth, validation, envelope, status codes) — the repo's SQL is
 * covered by test/unit/@system/contact-repo.test.js.
 *
 * Contract under test:
 *   GET    /api/contact/config      public config (turnstile site key only when enforced)
 *   POST   /api/contact             public: 201 envelope, honeypot 400, zod 400, turnstile, 503, CSRF, 429
 *   GET    /api/contact             admin list { data, pagination, unreadCount }, 503 when table missing
 *   PATCH  /api/contact/:id/read    admin
 *   PATCH  /api/contact/:id/unread  admin
 *   DELETE /api/contact/:id         admin (GDPR erasure)
 */

const request = require('supertest')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const fs = require('fs')
const path = require('path')

// RSA key pair for JWT signing (must happen before app require)
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})
process.env.JWT_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n')
process.env.JWT_PUBLIC_KEY = publicKey.replace(/\n/g, '\\n')
delete process.env.TURNSTILE_SECRET_KEY
delete process.env.CONTACT_RETENTION_DAYS
delete process.env.SKIP_CSRF

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock('../../../src/lib/@system/PostgreSQL', () => {
  const mockDb = {
    _reset() {
      for (const k of ['one', 'oneOrNone', 'none', 'any', 'result']) mockDb[k].mockReset()
    },
    one: jest.fn(),
    oneOrNone: jest.fn(),
    none: jest.fn(),
    any: jest.fn(),
    result: jest.fn(),
    tx: jest.fn(async (fn) => fn(mockDb)),
  }
  return mockDb
})

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

jest.mock('../../../src/lib/@system/Email', () => ({
  send: jest.fn().mockResolvedValue(true),
  sendEmail: jest.fn().mockResolvedValue(true),
}))

jest.mock('../../../src/db/repos/@system/ContactRepo', () => ({
  create: jest.fn(),
  list: jest.fn(),
  markRead: jest.fn(),
  markUnread: jest.fn(),
  remove: jest.fn(),
  purgeExpired: jest.fn(),
  findById: jest.fn(),
}))

// Brand is injected per test so we can flip Turnstile on/off without touching brand.json.
jest.mock('../../../src/lib/@system/Brand', () => {
  let brand = {}
  return {
    loadBrand: jest.fn(() => brand),
    resetBrandCache: jest.fn(),
    __setBrand(next) { brand = next },
  }
})

jest.mock('../../../src/api/@system/contact/turnstile', () => ({
  verifyTurnstile: jest.fn(),
  SITEVERIFY_URL: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
}))

const app = require('../../../src/app')
const db = require('../../../src/lib/@system/PostgreSQL')
const Email = require('../../../src/lib/@system/Email')
const ContactRepo = require('../../../src/db/repos/@system/ContactRepo')
const Brand = require('../../../src/lib/@system/Brand')
const { verifyTurnstile } = require('../../../src/api/@system/contact/turnstile')

// ── Fixtures ───────────────────────────────────────────────────────────────
const USER = {
  id: 'contact-user-001',
  email: 'member@example.com',
  name: 'Member',
  role: 'user',
  password_hash: '$2b$12$placeholder',
  email_verified_at: null,
  onboarding_completed: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}
const ADMIN = { ...USER, id: 'contact-admin-001', email: 'admin@example.com', name: 'Admin', role: 'admin' }

const VALID = {
  name: 'Ana Silva',
  email: 'Ana@Example.com',
  message: 'I would like to book a consultation next week.',
  website: '',
}

const NOW = '2026-09-20T10:00:00.000Z'
const ROW = {
  id: 7,
  name: 'Ana Silva',
  email: 'ana@example.com',
  phone: null,
  subject: null,
  message: VALID.message,
  source_path: '/',
  ip: '127.0.0.1',
  created_at: NOW,
  read_at: null,
  retention_expires_at: '2027-03-19T10:00:00.000Z',
}

function signTestToken(user = USER) {
  return jwt.sign({ userId: user.id }, privateKey, { algorithm: 'RS256', expiresIn: '15m' })
}

function asAdmin(req) {
  db.oneOrNone.mockResolvedValueOnce(ADMIN)
  return req.set('Authorization', `Bearer ${signTestToken(ADMIN)}`)
}

function asUser(req) {
  db.oneOrNone.mockResolvedValueOnce(USER)
  return req.set('Authorization', `Bearer ${signTestToken(USER)}`)
}

beforeEach(() => {
  db._reset()
  jest.clearAllMocks()
  Brand.__setBrand({})
  delete process.env.TURNSTILE_SECRET_KEY
  ContactRepo.create.mockResolvedValue(ROW)
})

// ──── GET /api/contact/config ─────────────────────────────────────────────
describe('GET /api/contact/config', () => {
  it('is public and reports defaults when nothing is configured', async () => {
    const res = await request(app).get('/api/contact/config')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { retentionDays: 180, turnstile: { siteKey: '' } } })
    expect(res.headers['cache-control']).toMatch(/public/)
  })

  it('hides the site key when the secret is missing (widget would never be verified)', async () => {
    Brand.__setBrand({ site: { contact: { turnstile: { siteKey: '1x000' }, retentionDays: 30 } } })
    const res = await request(app).get('/api/contact/config')
    expect(res.body.data.turnstile.siteKey).toBe('')
    expect(res.body.data.retentionDays).toBe(30)
  })

  it('exposes the site key when both site key and secret are configured', async () => {
    Brand.__setBrand({ site: { contact: { turnstile: { siteKey: '1x000' } } } })
    process.env.TURNSTILE_SECRET_KEY = 'secret'
    const res = await request(app).get('/api/contact/config')
    expect(res.body.data.turnstile.siteKey).toBe('1x000')
    expect(JSON.stringify(res.body)).not.toContain('secret')
  })
})

// ──── POST /api/contact ───────────────────────────────────────────────────
describe('POST /api/contact', () => {
  it('201 happy path: stores via the repo, lower-cases the email, returns { data: { id, createdAt } }', async () => {
    process.env.CONTACT_NOTIFY_EMAIL = 'owner@example.com'
    const res = await request(app).post('/api/contact').set('User-Agent', 'jest').send({ ...VALID, sourcePath: '/#contact' })

    expect(res.status).toBe(201)
    expect(res.body).toEqual({ data: { id: 7, createdAt: NOW } })
    expect(ContactRepo.create).toHaveBeenCalledTimes(1)
    const arg = ContactRepo.create.mock.calls[0][0]
    expect(arg).toMatchObject({
      name: 'Ana Silva',
      email: 'ana@example.com',
      message: VALID.message,
      sourcePath: '/#contact',
      userAgent: 'jest',
      retentionDays: 180,
    })
    expect(arg.ip).toBeTruthy()
    // Notification is fire-and-forget — give the microtask a tick.
    await new Promise((r) => setImmediate(r))
    expect(Email.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'owner@example.com', replyTo: 'ana@example.com' }))
    delete process.env.CONTACT_NOTIFY_EMAIL
  })

  it('does not leak ip/user_agent or internals in the 201 body', async () => {
    const res = await request(app).post('/api/contact').send(VALID)
    expect(Object.keys(res.body.data).sort()).toEqual(['createdAt', 'id'])
  })

  it('400 generic error when the honeypot is filled — nothing is stored', async () => {
    const res = await request(app).post('/api/contact').send({ ...VALID, website: 'http://spam.example' })
    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Validation failed')
    expect(res.body.errors).toEqual([{ field: 'body', message: 'Invalid submission' }])
    expect(ContactRepo.create).not.toHaveBeenCalled()
  })

  it('400 with field errors from zod', async () => {
    const res = await request(app).post('/api/contact').send({ name: 'A', email: 'nope', message: 'short' })
    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Validation failed')
    const fields = res.body.errors.map((e) => e.field)
    expect(fields).toEqual(expect.arrayContaining(['body.name', 'body.email', 'body.message']))
    expect(ContactRepo.create).not.toHaveBeenCalled()
  })

  it('503 when the table is missing (migration not run)', async () => {
    ContactRepo.create.mockRejectedValueOnce(Object.assign(new Error('relation "contact_submissions" does not exist'), { code: '42P01' }))
    const res = await request(app).post('/api/contact').send(VALID)
    expect(res.status).toBe(503)
    expect(res.body).toEqual({ message: 'Contact form is temporarily unavailable' })
  })

  it('uses the configured retention window from brand.json', async () => {
    Brand.__setBrand({ site: { contact: { retentionDays: 45 } } })
    await request(app).post('/api/contact').send(VALID)
    expect(ContactRepo.create.mock.calls[0][0].retentionDays).toBe(45)
  })

  it('falls back to CONTACT_RETENTION_DAYS when brand.json has no value', async () => {
    process.env.CONTACT_RETENTION_DAYS = '90'
    await request(app).post('/api/contact').send(VALID)
    expect(ContactRepo.create.mock.calls[0][0].retentionDays).toBe(90)
    delete process.env.CONTACT_RETENTION_DAYS
  })

  describe('Turnstile', () => {
    function enforce() {
      Brand.__setBrand({ site: { contact: { turnstile: { siteKey: '1x000' } } } })
      process.env.TURNSTILE_SECRET_KEY = 'shh'
    }

    it('skips verification entirely when not configured', async () => {
      const res = await request(app).post('/api/contact').send(VALID)
      expect(res.status).toBe(201)
      expect(verifyTurnstile).not.toHaveBeenCalled()
    })

    it('400 when enforced and the token is missing or invalid', async () => {
      enforce()
      verifyTurnstile.mockResolvedValueOnce({ ok: false, reason: 'missing_token' })
      const res = await request(app).post('/api/contact').send(VALID)
      expect(res.status).toBe(400)
      expect(res.body.errors).toEqual([{ field: 'body.turnstileToken', message: 'Anti-spam verification failed' }])
      expect(ContactRepo.create).not.toHaveBeenCalled()
    })

    it('201 when enforced and the token verifies (secret + visitor ip forwarded)', async () => {
      enforce()
      verifyTurnstile.mockResolvedValueOnce({ ok: true })
      const res = await request(app).post('/api/contact').send({ ...VALID, turnstileToken: 'tok' })
      expect(res.status).toBe(201)
      expect(verifyTurnstile).toHaveBeenCalledWith('tok', expect.objectContaining({ secretKey: 'shh', remoteIp: expect.any(String) }))
    })

    it('503 (fail closed) when siteverify is unreachable', async () => {
      enforce()
      verifyTurnstile.mockResolvedValueOnce({ ok: false, reason: 'unavailable' })
      const res = await request(app).post('/api/contact').send({ ...VALID, turnstileToken: 'tok' })
      expect(res.status).toBe(503)
      expect(ContactRepo.create).not.toHaveBeenCalled()
    })
  })

  describe('CSRF (double-submit, enforced outside test env)', () => {
    const csrfSrc = fs.readFileSync(path.join(__dirname, '../../../src/lib/@system/Middleware/csrf.js'), 'utf8')

    it('/api/contact is NOT in CSRF_EXEMPT_PATHS — the client sends the token like every other form', () => {
      const match = csrfSrc.match(/const CSRF_EXEMPT_PATHS\s*=\s*\[([\s\S]*?)\]/)
      expect(match).not.toBeNull()
      expect(match[1]).not.toContain("'/api/contact'")
      expect(match[1]).not.toContain('"/api/contact"')
    })

    // The csrf middleware checks NODE_ENV per request, so flipping it for a
    // single call exercises the real 403 path without a production build.
    async function withEnforcedCsrf(fn) {
      const prev = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'
      try {
        // supertest's Test is a thenable, not a Promise — await it, never .finally() it.
        return await fn()
      } finally {
        process.env.NODE_ENV = prev
      }
    }

    it('403 without X-CSRF-Token when CSRF is enforced', async () => {
      const res = await withEnforcedCsrf(() => request(app).post('/api/contact').send(VALID))
      expect(res.status).toBe(403)
      expect(res.body.error).toBe('CSRF_VALIDATION_FAILED')
      expect(ContactRepo.create).not.toHaveBeenCalled()
    })

    it('201 with the token + cookie from GET /api/csrf-token (anonymous visitor flow)', async () => {
      const tokenRes = await request(app).get('/api/csrf-token')
      const cookies = tokenRes.headers['set-cookie']
      const res = await withEnforcedCsrf(() =>
        request(app)
          .post('/api/contact')
          .set('Cookie', cookies)
          .set('X-CSRF-Token', tokenRes.body.csrfToken)
          .send(VALID),
      )
      expect(res.status).toBe(201)
    })
  })

  describe('rate limit (enforced outside test/development env)', () => {
    it('429 after 5 submissions per IP per window', async () => {
      const tokenRes = await request(app).get('/api/csrf-token')
      const cookies = tokenRes.headers['set-cookie']
      const prev = process.env.NODE_ENV
      process.env.NODE_ENV = 'staging'
      const statuses = []
      try {
        for (let i = 0; i < 7 && !statuses.includes(429); i++) {
          const res = await request(app)
            .post('/api/contact')
            .set('Cookie', cookies)
            .set('X-CSRF-Token', tokenRes.body.csrfToken)
            .send(VALID)
          statuses.push(res.status)
          if (res.status === 429) {
            expect(res.body.message).toMatch(/too many messages/i)
            expect(res.headers['retry-after']).toBeDefined()
          }
        }
      } finally {
        process.env.NODE_ENV = prev
      }
      expect(statuses).toContain(429)
      // Everything before the 429 was accepted; the limiter kicks in by the 6th hit.
      expect(statuses.slice(0, statuses.indexOf(429)).every((s) => s === 201)).toBe(true)
      expect(statuses.indexOf(429)).toBeLessThanOrEqual(5)
    })
  })
})

// ──── GET /api/contact (admin) ────────────────────────────────────────────
describe('GET /api/contact', () => {
  it('401 without auth', async () => {
    const res = await request(app).get('/api/contact')
    expect(res.status).toBe(401)
  })

  it('403 for a non-admin member', async () => {
    const res = await asUser(request(app).get('/api/contact'))
    expect(res.status).toBe(403)
  })

  it('200 { data, pagination, unreadCount } without ip/user_agent, camelCased', async () => {
    ContactRepo.list.mockResolvedValueOnce({ rows: [ROW], total: 1, unreadCount: 1 })
    const res = await asAdmin(request(app).get('/api/contact?page=1&limit=25'))
    expect(res.status).toBe(200)
    expect(res.body.pagination).toEqual({ total: 1, page: 1, pages: 1, limit: 25 })
    expect(res.body.unreadCount).toBe(1)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0]).toEqual({
      id: 7,
      name: 'Ana Silva',
      email: 'ana@example.com',
      phone: null,
      subject: null,
      message: VALID.message,
      sourcePath: '/',
      createdAt: NOW,
      readAt: null,
      retentionExpiresAt: ROW.retention_expires_at,
    })
    expect(res.body.data[0]).not.toHaveProperty('ip')
    expect(res.body.data[0]).not.toHaveProperty('user_agent')
    expect(ContactRepo.list).toHaveBeenCalledWith({ page: 1, limit: 25, unread: undefined })
  })

  it('passes the unread filter through as a boolean', async () => {
    ContactRepo.list.mockResolvedValueOnce({ rows: [], total: 0, unreadCount: 0 })
    await asAdmin(request(app).get('/api/contact?unread=true'))
    expect(ContactRepo.list).toHaveBeenCalledWith(expect.objectContaining({ unread: true }))
  })

  it('400 on an invalid query', async () => {
    const res = await asAdmin(request(app).get('/api/contact?limit=1000'))
    expect(res.status).toBe(400)
  })

  it('503 (not an empty 200) when the table is missing', async () => {
    ContactRepo.list.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: '42P01' }))
    const res = await asAdmin(request(app).get('/api/contact'))
    expect(res.status).toBe(503)
    expect(res.body).toEqual({ message: 'Contact form is temporarily unavailable' })
  })
})

// ──── PATCH read / unread ─────────────────────────────────────────────────
describe('PATCH /api/contact/:id/read', () => {
  it('401 / 403 gating', async () => {
    expect((await request(app).patch('/api/contact/7/read')).status).toBe(401)
    expect((await asUser(request(app).patch('/api/contact/7/read'))).status).toBe(403)
  })

  it('200 { data: { id, readAt } }', async () => {
    ContactRepo.markRead.mockResolvedValueOnce({ id: 7, read_at: NOW })
    const res = await asAdmin(request(app).patch('/api/contact/7/read'))
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { id: 7, readAt: NOW } })
    expect(ContactRepo.markRead).toHaveBeenCalledWith(7)
  })

  it('404 when missing, 400 for a non-numeric id', async () => {
    ContactRepo.markRead.mockResolvedValueOnce(null)
    expect((await asAdmin(request(app).patch('/api/contact/999/read'))).status).toBe(404)
    expect((await asAdmin(request(app).patch('/api/contact/abc/read'))).status).toBe(400)
  })
})

describe('PATCH /api/contact/:id/unread', () => {
  it('401 / 403 gating', async () => {
    expect((await request(app).patch('/api/contact/7/unread')).status).toBe(401)
    expect((await asUser(request(app).patch('/api/contact/7/unread'))).status).toBe(403)
  })

  it('200 { data: { id, readAt: null } }', async () => {
    ContactRepo.markUnread.mockResolvedValueOnce({ id: 7, read_at: null })
    const res = await asAdmin(request(app).patch('/api/contact/7/unread'))
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { id: 7, readAt: null } })
  })

  it('404 when missing', async () => {
    ContactRepo.markUnread.mockResolvedValueOnce(null)
    expect((await asAdmin(request(app).patch('/api/contact/999/unread'))).status).toBe(404)
  })
})

// ──── DELETE (GDPR erasure) ───────────────────────────────────────────────
describe('DELETE /api/contact/:id', () => {
  it('401 / 403 gating', async () => {
    expect((await request(app).delete('/api/contact/7')).status).toBe(401)
    expect((await asUser(request(app).delete('/api/contact/7'))).status).toBe(403)
    expect(ContactRepo.remove).not.toHaveBeenCalled()
  })

  it('200 { message } when removed', async () => {
    ContactRepo.remove.mockResolvedValueOnce(true)
    const res = await asAdmin(request(app).delete('/api/contact/7'))
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ message: 'Submission deleted' })
    expect(ContactRepo.remove).toHaveBeenCalledWith(7)
  })

  it('404 when nothing was removed', async () => {
    ContactRepo.remove.mockResolvedValueOnce(false)
    expect((await asAdmin(request(app).delete('/api/contact/999'))).status).toBe(404)
  })
})
