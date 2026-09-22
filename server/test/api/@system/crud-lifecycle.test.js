/**
 * Full CRUD lifecycle test — user resource
 *
 * Tests the complete Create → Read → Update → Delete lifecycle for the
 * user entity using the Express app with mocked DB and Redis.
 *
 * Lifecycle:
 *   Create  POST /api/users          — register a new user
 *   Read    GET  /api/users/me       — read own profile (JWT auth)
 *   Update  PATCH /api/users/me      — update profile name (JWT auth)
 *   Delete  DELETE /api/sessions     — log out (session teardown)
 */

const request = require('supertest')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')

// ── Generate RSA key pair for JWT signing (must happen before app require) ──
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})
process.env.JWT_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n')
process.env.JWT_PUBLIC_KEY = publicKey.replace(/\n/g, '\\n')

// ── Mock PostgreSQL ─────────────────────────────────────────────────────────
jest.mock('../../../src/lib/@system/PostgreSQL', () => {
  const mockDb = {
    _reset() {
      mockDb.one.mockReset()
      mockDb.oneOrNone.mockReset()
      mockDb.none.mockReset()
      mockDb.any.mockReset()
    },
    one: jest.fn(),
    oneOrNone: jest.fn(),
    none: jest.fn(),
    any: jest.fn(),
    tx: jest.fn(async (fn) => fn(mockDb)),
  }
  return mockDb
})

// ── Mock Redis ──────────────────────────────────────────────────────────────
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

// ── Mock Email ──────────────────────────────────────────────────────────────
jest.mock('../../../src/lib/@system/Email', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}))

// Feature modules: this suite exercises the `selfRegistration` module, which the
// informational brand.json switches off. Enable it for this file only —
// Helpers/modules.js reads MODULES_JSON when the app loads.
process.env.MODULES_JSON = JSON.stringify({ selfRegistration: true })
afterAll(() => { delete process.env.MODULES_JSON })
const app = require('../../../src/app')
const db = require('../../../src/lib/@system/PostgreSQL')

// ── Test fixtures ───────────────────────────────────────────────────────────
const TEST_USER = {
  id: 'crud-lifecycle-user-001',
  email: 'lifecycle@example.com',
  name: 'Lifecycle User',
  role: 'user',
  password_hash: '$2b$12$placeholder',
  email_verified_at: null,
  onboarding_completed: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

/** Sign a short-lived JWT for TEST_USER using the test private key. */
function signTestToken(userId = TEST_USER.id) {
  return jwt.sign({ userId }, privateKey, {
    algorithm: 'RS256',
    expiresIn: '15m',
  })
}

beforeEach(() => {
  db._reset()
})

// ─────────────────────────────────────────────────────────────────────────────
// CRUD lifecycle — sequential steps
// ─────────────────────────────────────────────────────────────────────────────

describe('Full CRUD lifecycle — user resource', () => {
  // ── C: Create ──────────────────────────────────────────────────────────────
  describe('Create — POST /api/users', () => {
    it('returns 400 when required fields are missing', async () => {
      const res = await request(app).post('/api/users').send({})
      expect(res.status).toBe(400)
    })

    it('registers a new user and returns 201 with id/email/name', async () => {
      // DB: no existing user, then return the created user
      db.oneOrNone.mockResolvedValueOnce(null)   // findByEmail → not found
      db.one.mockResolvedValueOnce(TEST_USER)     // UserRepo.create → new row
      db.none.mockResolvedValue(undefined)        // email token insert (async)

      const res = await request(app)
        .post('/api/users')
        .send({ email: TEST_USER.email, password: 'SecureP@ss1234!', name: TEST_USER.name })

      expect(res.status).toBe(201)
      expect(res.body.user).toBeDefined()
      expect(res.body.user.email).toBe(TEST_USER.email)
      expect(res.body.user.name).toBe(TEST_USER.name)
      expect(res.body.user.id).toBeDefined()
    })

    it('returns 409 when email is already in use', async () => {
      db.oneOrNone.mockResolvedValueOnce(TEST_USER)  // findByEmail → exists

      const res = await request(app)
        .post('/api/users')
        .send({ email: TEST_USER.email, password: 'SecureP@ss1234!', name: TEST_USER.name })

      expect(res.status).toBe(409)
    })
  })

  // ── R: Read ────────────────────────────────────────────────────────────────
  describe('Read — GET /api/users/me', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/users/me')
      expect(res.status).toBe(401)
    })

    it('returns 200 with user profile when authenticated via JWT', async () => {
      // Auth middleware calls UserRepo.findById → oneOrNone
      db.oneOrNone.mockResolvedValueOnce(TEST_USER)

      const token = signTestToken()
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.user).toBeDefined()
      expect(res.body.user.id).toBe(TEST_USER.id)
      expect(res.body.user.email).toBe(TEST_USER.email)
    })
  })

  // ── U: Update ──────────────────────────────────────────────────────────────
  describe('Update — PATCH /api/users/me', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).patch('/api/users/me').send({ name: 'New Name' })
      expect(res.status).toBe(401)
    })

    it('updates the user name and returns the updated profile', async () => {
      const updatedUser = { ...TEST_USER, name: 'Updated Name' }

      // Auth middleware: findById
      db.oneOrNone.mockResolvedValueOnce(TEST_USER)
      // UserRepo.update returns updated row
      db.one.mockResolvedValueOnce({
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
      })

      const token = signTestToken()
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name' })

      expect(res.status).toBe(200)
      expect(res.body.user).toBeDefined()
      expect(res.body.user.name).toBe('Updated Name')
    })

    it('returns 400 when name is empty string', async () => {
      // Auth middleware: findById
      db.oneOrNone.mockResolvedValueOnce(TEST_USER)

      const token = signTestToken()
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '' })

      expect([400, 422]).toContain(res.status)
    })
  })

  // ── D: Delete (session teardown / logout) ──────────────────────────────────
  describe('Delete — DELETE /api/sessions (logout)', () => {
    it('returns 200 and clears session even without auth (idempotent)', async () => {
      const res = await request(app).delete('/api/sessions')
      expect(res.status).toBe(200)
      expect(res.body.message).toMatch(/logged out/i)
    })

    it('returns 200 and logs out an authenticated user', async () => {
      // Auth middleware for sessions DELETE does not require auth (idempotent logout)
      const token = signTestToken()
      const res = await request(app)
        .delete('/api/sessions')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.message).toMatch(/logged out/i)
    })
  })
})
