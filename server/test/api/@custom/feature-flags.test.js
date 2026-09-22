/**
 * API tests for feature-flags admin endpoints (@custom)
 *
 * Tests the double-submit guard behaviour enforced by the frontend.
 * All feature-flags routes are protected by authenticate + requireAdmin.
 */

const request = require('supertest')
const crypto = require('crypto')

// ── Mock DB ────────────────────────────────────────────────────────────
jest.mock('../../../src/lib/@system/PostgreSQL', () => {
  const mockDb = {
    one: jest.fn(),
    oneOrNone: jest.fn(),
    none: jest.fn(),
    any: jest.fn(),
    task: jest.fn(async (fn) => fn(mockDb)),
    tx: jest.fn(async (fn) => fn(mockDb)),
  }
  return mockDb
})

// ── Mock FeatureFlagRepo ────────────────────────────────────────────────
const mockFeatureFlags = [
  { key: 'dark_mode', label: 'Dark Mode', category: 'general', enabled: true, description: null },
  { key: 'beta_dashboard', label: 'Beta Dashboard', category: 'beta', enabled: false, description: 'New UI' },
]

const MockFeatureFlagRepo = {
  findAll: jest.fn(async ({ category } = {}) => {
    if (category) return mockFeatureFlags.filter(f => f.category === category)
    return mockFeatureFlags
  }),
  findByKey: jest.fn(async (key) => mockFeatureFlags.find(f => f.key === key) || null),
  isEnabled: jest.fn(async (key) => {
    const flag = mockFeatureFlags.find(f => f.key === key)
    return flag ? flag.enabled : false
  }),
  toggle: jest.fn(async (key, enabled, userId) => {
    const flag = mockFeatureFlags.find(f => f.key === key)
    if (!flag) return null
    return { ...flag, enabled, updated_by: userId }
  }),
  create: jest.fn(async ({ key, label, description, category, enabled }) => {
    const flag = { key, label, description, category, enabled }
    return flag
  }),
  delete: jest.fn(async (key) => {
    const flag = mockFeatureFlags.find(f => f.key === key)
    return flag || null
  }),
  getCategories: jest.fn(async () => ['general', 'beta']),
}

jest.mock('../../../src/db/repos/@system/FeatureFlagRepo', () => MockFeatureFlagRepo)

// ── Mock Redis ──────────────────────────────────────────────────────────
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

// ── Mock Email ──────────────────────────────────────────────────────────
jest.mock('../../../src/lib/@system/Email', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}))
// ── JWT keys for test auth ─────────────────────────────────────────────
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})
process.env.JWT_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n')
process.env.JWT_PUBLIC_KEY = publicKey.replace(/\n/g, '\\n')

// Mock UserRepo so that auth middleware can resolve a user
const mockAdminUser = {
  id: 1,
  email: 'admin@test.com',
  role: 'admin',
  name: 'Admin',
}
jest.mock('../../../src/db/repos/@system/UserRepo', () => ({
  findById: jest.fn(async (id) => id === 1 ? mockAdminUser : null),
}))

// Mock SessionRepo for auth token validation
jest.mock('../../../src/db/repos/@system/SessionRepo', () => ({
  findByToken: jest.fn(async () => ({ user_id: 1, id: 1, expires_at: new Date(Date.now() + 86400000).toISOString() })),
}))

const jwt = require('jsonwebtoken')
const app = require('../../../src/app')

function adminToken() {
  return jwt.sign(
    { userId: 1, email: 'admin@test.com', role: 'admin' },
    privateKey,
    { algorithm: 'RS256', expiresIn: '1h' }
  )
}

function authHeader() {
  return { Authorization: `Bearer ${adminToken()}` }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('Feature Flags API — auth guards', () => {
  it('GET /api/admin/feature-flags returns 401 without auth', async () => {
    const res = await request(app).get('/api/admin/feature-flags')
    expect(res.status).toBe(401)
  })

  it('POST /api/admin/feature-flags returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/admin/feature-flags')
      .send({ key: 'test', label: 'Test', category: 'general' })
    expect(res.status).toBe(401)
  })

  it('PATCH /api/admin/feature-flags/:key returns 401 without auth', async () => {
    const res = await request(app)
      .patch('/api/admin/feature-flags/dark_mode')
      .send({ enabled: true })
    expect(res.status).toBe(401)
  })

  it('DELETE /api/admin/feature-flags/:key returns 401 without auth', async () => {
    const res = await request(app).delete('/api/admin/feature-flags/dark_mode')
    expect(res.status).toBe(401)
  })
})

describe('Feature Flags API — CRUD operations', () => {
  it('GET /api/admin/feature-flags returns all flags', async () => {
    const res = await request(app)
      .get('/api/admin/feature-flags')
      .set(authHeader())
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('flags')
    expect(res.body.flags).toHaveLength(2)
  })

  it('GET /api/admin/feature-flags filters by category', async () => {
    const res = await request(app)
      .get('/api/admin/feature-flags?category=general')
      .set(authHeader())
    expect(res.status).toBe(200)
    expect(res.body.flags).toHaveLength(1)
    expect(res.body.flags[0].key).toBe('dark_mode')
  })

  it('POST /api/admin/feature-flags creates a new flag', async () => {
    const res = await request(app)
      .post('/api/admin/feature-flags')
      .set(authHeader())
      .send({ key: 'new_flag', label: 'New Flag', category: 'general' })
    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('flag')
    expect(res.body.flag.key).toBe('new_flag')
  })

  it('PATCH /api/admin/feature-flags/:key toggles a flag', async () => {
    const res = await request(app)
      .patch('/api/admin/feature-flags/dark_mode')
      .set(authHeader())
      .send({ enabled: false })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('flag')
    expect(res.body.flag.enabled).toBe(false)
  })

  it('DELETE /api/admin/feature-flags/:key removes a flag', async () => {
    const res = await request(app)
      .delete('/api/admin/feature-flags/dark_mode')
      .set(authHeader())
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('message', 'Deleted')
  })

  it('PATCH non-existent flag returns 404', async () => {
    const res = await request(app)
      .patch('/api/admin/feature-flags/nonexistent')
      .set(authHeader())
      .send({ enabled: true })
    expect(res.status).toBe(404)
  })

  it('DELETE non-existent flag returns 404', async () => {
    const res = await request(app)
      .delete('/api/admin/feature-flags/nonexistent')
      .set(authHeader())
    expect(res.status).toBe(404)
  })

  it('POST with duplicate key returns 409 conflict', async () => {
    const dupErr = new Error('duplicate key')
    dupErr.code = '23505'
    MockFeatureFlagRepo.create.mockRejectedValueOnce(dupErr)
    const res = await request(app)
      .post('/api/admin/feature-flags')
      .set(authHeader())
      .send({ key: 'existing', label: 'Existing', category: 'general' })
    expect(res.status).toBe(409)
  })
})