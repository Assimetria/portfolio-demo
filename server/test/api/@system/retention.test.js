/**
 * API tests for /api/retention & /api/retention/cleanup
 *
 * These run against the real Express app with DB / Redis / Email mocked so
 * they are deterministic and CI-safe.  The AuditLog module is mocked so we
 * can assert the retention route's request contract (auth, admin gating,
 * validation and response shape) without touching a real audit table.
 *
 * Contract under test:
 *   GET  /api/retention          - read-only policy, requires auth
 *   POST /api/retention/cleanup - admin-only purge trigger, rate limited
 */

const request = require('supertest')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')

// Generate RSA key pair for JWT signing (must happen before app require)
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})
process.env.JWT_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n')
process.env.JWT_PUBLIC_KEY = publicKey.replace(/\n/g, '\\n')
// Retention endpoint reads the env default; drop it so we exercise the default.
delete process.env.AUDIT_LOG_RETENTION_DAYS

// ── Mock PostgreSQL ────────────────────────────────────────────────────────
jest.mock('../../../src/lib/@system/PostgreSQL', () => {
  const mockDb = {
    _reset() {
      mockDb.one.mockReset()
      mockDb.oneOrNone.mockReset()
      mockDb.none.mockReset()
      mockDb.any.mockReset()
      if (mockDb.result) mockDb.result.mockReset()
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

// ── Mock AuditLog so the route never touches the real audit table ─────────
jest.mock('../../../src/lib/@system/AuditLog', () => ({
  cleanOldLogs: jest.fn().mockResolvedValue(0),
  logAction: jest.fn().mockResolvedValue({}),
  logDataChange: jest.fn().mockResolvedValue({}),
  logAuthEvent: jest.fn().mockResolvedValue({}),
  logSecurityEvent: jest.fn().mockResolvedValue({}),
  queryLogs: jest.fn().mockResolvedValue([]),
  getUserLogs: jest.fn().mockResolvedValue([]),
  getResourceLogs: jest.fn().mockResolvedValue([]),
  auditMiddleware: jest.fn((_req, _res, next) => next()),
}))

const app = require('../../../src/app')
const db = require('../../../src/lib/@system/PostgreSQL')
const AuditLog = require('../../../src/lib/@system/AuditLog')

// ── Test fixtures ───────────────────────────────────────────────────────────
const USER = {
  id: 'retention-user-001',
  email: 'member@example.com',
  name: 'Retention Member',
  role: 'user',
  password_hash: '$2b$12$placeholder',
  email_verified_at: null,
  onboarding_completed: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

// Admin differs only in identity/role so the tests exercise role gating.
const ADMIN = {
  ...USER,
  id: 'retention-admin-001',
  email: 'admin@example.com',
  name: 'Retention Admin',
  role: 'admin',
}

/** Sign a short-lived JWT for an arbitrary user fixture. */
function signTestToken(user = USER) {
  return jwt.sign({ userId: user.id }, privateKey, {
    algorithm: 'RS256',
    expiresIn: '15m',
  })
}

beforeEach(() => {
  db._reset()
  jest.clearAllMocks()
  AuditLog.cleanOldLogs.mockResolvedValue(0)
  AuditLog.logAction.mockResolvedValue({})
})

// ──── GET /api/retention — read-only policy ───────────────────────────────
describe('GET /api/retention', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/retention')
    expect(res.status).toBe(401)
  })

  it('returns the policy body shape for an authenticated member', async () => {
    db.oneOrNone.mockResolvedValueOnce(USER)

    const res = await request(app)
      .get('/api/retention')
      .set('Authorization', `Bearer ${signTestToken(USER)}`)

    expect(res.status).toBe(200)
    expect(res.body.retention).toBeDefined()
    expect(res.body.retention.scope).toBe('audit_logs')
    expect(typeof res.body.retention.defaultDays).toBe('number')
    expect(typeof res.body.retention.configuredDays).toBe('number')
    // `cutoffAt` is an ISO timestamp — Date.parse must accept it.
    expect(new Date(res.body.retention.cutoffAt).toString()).not.toBe('Invalid Date')
  })

  it('falls back to the default when the env variable is unset', async () => {
    delete process.env.AUDIT_LOG_RETENTION_DAYS
    db.oneOrNone.mockResolvedValueOnce(USER)

    const res = await request(app)
      .get('/api/retention')
      .set('Authorization', `Bearer ${signTestToken(USER)}`)

    expect(res.status).toBe(200)
    expect(res.body.retention.configuredDays).toBe(res.body.retention.defaultDays)
  })
})

// ──── POST /api/retention/cleanup — admin-only purge trigger ──────────────
describe('POST /api/retention/cleanup', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).post('/api/retention/cleanup').send({ days: 30 })
    expect(res.status).toBe(401)
  })

  it('returns 403 for an authenticated non-admin member', async () => {
    db.oneOrNone.mockResolvedValueOnce(USER)

    const res = await request(app)
      .post('/api/retention/cleanup')
      .set('Authorization', `Bearer ${signTestToken(USER)}`)
      .send({ days: 30 })

    expect(res.status).toBe(403)
  })

  it('returns 400 and does not purge when days is not an integer', async () => {
    db.oneOrNone.mockResolvedValueOnce(ADMIN)

    const res = await request(app)
      .post('/api/retention/cleanup')
      .set('Authorization', `Bearer ${signTestToken(ADMIN)}`)
      .send({ days: 12.5 })

    expect(res.status).toBe(400)
    expect(AuditLog.cleanOldLogs).not.toHaveBeenCalled()
  })

  it('returns 400 and does not purge when days is out of range', async () => {
    db.oneOrNone.mockResolvedValueOnce(ADMIN)

    const res = await request(app)
      .post('/api/retention/cleanup')
      .set('Authorization', `Bearer ${signTestToken(ADMIN)}`)
      .send({ days: 0 })

    expect(res.status).toBe(400)
    expect(AuditLog.cleanOldLogs).not.toHaveBeenCalled()
  })

  it('purges and returns the deleted count for an admin', async () => {
    db.oneOrNone.mockResolvedValueOnce(ADMIN)
    AuditLog.cleanOldLogs.mockResolvedValue(17)

    const res = await request(app)
      .post('/api/retention/cleanup')
      .set('Authorization', `Bearer ${signTestToken(ADMIN)}`)
      .send({ days: 45 })

    expect(res.status).toBe(200)
    expect(AuditLog.cleanOldLogs).toHaveBeenCalledWith(45)
    expect(res.body.cleanup).toBeDefined()
    expect(res.body.cleanup.scope).toBe('audit_logs')
    expect(res.body.cleanup.retentionDays).toBe(45)
    expect(res.body.cleanup.deleted).toBe(17)
    expect(res.body.message).toMatch(/complete/i)
    // The triggerer is recorded in the audit trail.
    expect(AuditLog.logAction).toHaveBeenCalled()
  })

  it('uses the configured default when no days are supplied', async () => {
    db.oneOrNone.mockResolvedValueOnce(ADMIN)
    AuditLog.cleanOldLogs.mockResolvedValue(3)

    const res = await request(app)
      .post('/api/retention/cleanup')
      .set('Authorization', `Bearer ${signTestToken(ADMIN)}`)
      .send({})

    expect(res.status).toBe(200)
    expect(res.body.cleanup.deleted).toBe(3)
  })
})

