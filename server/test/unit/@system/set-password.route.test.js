// Route-level unit tests for the first-login "set password" flow endpoints:
//
//   POST /api/users/provision      — [admin] creates a password-less account and
//                                    emails a one-time set-password link.
//   POST /api/users/password/set   — recipient chooses their initial password
//                                    with the single-use provisioning token.
//
// The router is exercised in isolation: repositories, the DB layer, email and
// rate limiting are all mocked, an app-level middleware injects the admin
// identity that the real requireAdmin() middleware inspects, and validation /
// password-strength rules run unmocked. No database, Redis, or transport is used.

'use strict'

const request = require('supertest')
const express = require('express')

const ADMIN = {
  id: 1,
  email: 'ops@example.com',
  name: 'Ops Admin',
  role: 'admin',
  emailVerified: true,
  onboardingCompleted: true,
}

// Password strong enough to pass the shared server-side password policy
// (>= 12 chars, uppercase, digit, special char).
const STRONG_PASSWORD = 'Sup3r!SecretPassw0rd2026'

// ── Mocks ──────────────────────────────────────────────────────────────────────

// Replace the DB layer that source repositories and inline handlers use.
jest.mock('../../../src/lib/@system/PostgreSQL', () => ({
  one: jest.fn(),
  oneOrNone: jest.fn(),
  none: jest.fn().mockResolvedValue(null),
  any: jest.fn(),
  tx: jest.fn(async (fn) => fn({ one: jest.fn(), none: jest.fn() })),
}))

// Repositories — replace wholesale so behaviour is deterministic and free of
// SQL/DBA coupling. Every module that imports these (the route here and the
// shared auth middleware) receives the same mocked instances via Jest's cache.
jest.mock('../../../src/db/repos/@system/UserRepo', () => ({
  findByEmail: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  findById: jest.fn(),
}))

jest.mock('../../../src/db/repos/@system/SessionRepo', () => ({
  revokeAllByUserId: jest.fn().mockResolvedValue(null),
  findActiveWithUser: jest.fn(),
  revoke: jest.fn(),
}))

// Silenced logger — kept as named exports (object of jest.fn) so real modules
// that import it do not attempt actual logging.
jest.mock('../../../src/lib/@system/Logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

// Rate limiting neutralised (no Redis dependency).
jest.mock('../../../src/lib/@system/RateLimit', () => ({
  registerLimiter: (req, _res, next) => next(),
  passwordResetLimiter: (req, _res, next) => next(),
}))

// Email senders — only the set-password sender is exercised by this flow.
jest.mock('../../../src/lib/@system/Email', () => ({
  sendSetPasswordEmail: jest.fn().mockResolvedValue({ messageId: 'set-1', provider: 'console', devMode: true }),
  sendVerificationEmail: jest.fn().mockResolvedValue({ messageId: 'v-1' }),
  sendWelcomeEmail: jest.fn().mockResolvedValue({ messageId: 'w-1' }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ messageId: 'r-1' }),
}))

// Import the modules under test AFTER the mocks above are registered.
const db = require('../../../src/lib/@system/PostgreSQL')
const UserRepo = require('../../../src/db/repos/@system/UserRepo')
const SessionRepo = require('../../../src/db/repos/@system/SessionRepo')
const Email = require('../../../src/lib/@system/Email')
const userRouter = require('../../../src/api/@system/user')

// Real auth middleware — requireAdmin() authorises based on req.user which the
// identity middleware below populates (authenticate() is not part of the
// provision route chain in production either).
function buildApp() {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    if (req.get('x-admin-identity') === '1') req.user = { ...ADMIN }
    next()
  })
  app.use(userRouter)
  return app
}

// Flush setImmediate() callbacks used by the endpoints for post-response,
// asynchronous email dispatch. The chain performs several awaited DB calls
// before the sender ultimately fires, so flush repeatedly.
async function flushAsync() {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setImmediate(resolve))
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  db.oneOrNone.mockResolvedValue(null)
  db.none.mockResolvedValue(null)
})

describe('POST /users/provision (admin set-password provisioning)', () => {
  it('403 when the caller is not authenticated as an admin', async () => {
    const app = buildApp()
    const res = await request(app)
      .post('/users/provision')
      .send({ email: 'ada@example.com', name: 'Ada Lovelace' })

    expect(res.status).toBe(403)
    expect(UserRepo.findByEmail).not.toHaveBeenCalled()
    expect(Email.sendSetPasswordEmail).not.toHaveBeenCalled()
  })

  it('creates a password-less account and emails a set-password link', async () => {
    UserRepo.findByEmail.mockResolvedValue(null)
    UserRepo.create.mockResolvedValue({ id: 11, email: 'ada@example.com', name: 'Ada Lovelace' })

    const app = buildApp()
    const res = await request(app)
      .post('/users/provision')
      .set('x-admin-identity', '1')
      .send({ email: 'ada@example.com', name: 'Ada Lovelace' })

    expect(res.status).toBe(201)
    expect(res.body.user).toEqual({ id: 11, email: 'ada@example.com', name: 'Ada Lovelace' })
    expect(UserRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ada@example.com',
        name: 'Ada Lovelace',
        password_hash: null,
        role: 'user',
      })
    )

    // The set-password email is sent asynchronously after the response.
    await flushAsync()
    expect(Email.sendSetPasswordEmail).toHaveBeenCalledTimes(1)
    expect(Email.sendSetPasswordEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'ada@example.com', userId: 11 })
    )
  })

  it('409 when a user with an existing password_hash is re-provisioned', async () => {
    UserRepo.findByEmail.mockResolvedValue({
      id: 11,
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      password_hash: '$2b$12$already-hashed',
    })

    const app = buildApp()
    const res = await request(app)
      .post('/users/provision')
      .set('x-admin-identity', '1')
      .send({ email: 'ada@example.com', name: 'Ada Lovelace' })

    expect(res.status).toBe(409)
    expect(Email.sendSetPasswordEmail).not.toHaveBeenCalled()
  })
})

describe('POST /users/password/set (consume provisioning token)', () => {
  it('sets the password and invalidates prior sessions for a valid token', async () => {
    db.oneOrNone.mockResolvedValue({ id: 5, user_id: 11 })

    const app = buildApp()
    const res = await request(app)
      .post('/users/password/set')
      .send({ token: 'onetime-provision-token', password: STRONG_PASSWORD })

    expect(res.status).toBe(200)
    expect(db.oneOrNone).toHaveBeenCalled() // token lookup
    expect(db.none).toHaveBeenCalled()       // password update + token invalidation
    expect(SessionRepo.revokeAllByUserId).toHaveBeenCalledWith(11)
  })

  it('400 for an invalid or expired provisioning token', async () => {
    db.oneOrNone.mockResolvedValue(null)

    const app = buildApp()
    const res = await request(app)
      .post('/users/password/set')
      .send({ token: 'expired-token', password: STRONG_PASSWORD })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/invalid or expired/i)
    expect(db.none).not.toHaveBeenCalled()
  })

  it('400 when the chosen password fails the strength policy', async () => {
    const app = buildApp()
    const res = await request(app)
      .post('/users/password/set')
      .send({ token: 'onetime-provision-token', password: 'short1!' })

    expect(res.status).toBe(400)
    expect(db.oneOrNone).not.toHaveBeenCalled()
  })
})

