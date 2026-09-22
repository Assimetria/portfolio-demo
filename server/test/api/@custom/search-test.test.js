/**
 * API tests for GET /api/search-test and POST /api/search-test/run (@custom)
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
// ── Mock SearchAdapter to return deterministic test results ─────────────────
jest.mock('../../../src/lib/@system/SearchAdapter', () => {
  const mockSearch = jest.fn(async ({ index, query, filters, sort, limit = 20, offset = 0, attributesToRetrieve }) => {
    const hits = [
      { id: 1, title: 'Test Result 1', category: 'docs', price: 0 },
      { id: 2, title: 'Test Result 2', category: 'features', price: 10 },
    ]
    return {
      hits,
      total: 2,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(2 / limit),
      processingTimeMs: 12,
    }
  })

  return {
    provider: 'none',
    search: mockSearch,
    health: jest.fn(async () => ({
      provider: 'none',
      configured: false,
      devMode: true,
    })),
    healthAll: jest.fn(async () => ({
      none: { provider: 'none', configured: false, devMode: true },
      meilisearch: { provider: 'meilisearch', configured: false, packageAvailable: false },
      algolia: { provider: 'algolia', configured: false, packageAvailable: false },
    })),
  }
})

// Set up JWT keys BEFORE requiring the app
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})
process.env.JWT_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n')
process.env.JWT_PUBLIC_KEY = publicKey.replace(/\n/g, '\\n')

const app = require('../../../src/app')
const Search = require('../../../src/lib/@system/SearchAdapter')

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/search-test', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/search-test')
    expect(res.status).toBe(401)
  })

  it('returns 401 with an invalid bearer token', async () => {
    const res = await request(app)
      .get('/api/search-test')
      .set('Authorization', 'Bearer invalid.token.here')
    expect(res.status).toBe(401)
  })

  it('returns JSON content-type on unauthorized', async () => {
    const res = await request(app).get('/api/search-test')
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })
})

describe('POST /api/search-test/run', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/search-test/run')
      .send({ index: 'test', q: 'hello' })
    expect(res.status).toBe(401)
  })

  it('returns 401 with an invalid bearer token', async () => {
    const res = await request(app)
      .post('/api/search-test/run')
      .set('Authorization', 'Bearer invalid.token.here')
      .send({ index: 'test', q: 'hello' })
    expect(res.status).toBe(401)
  })

  it('rejects request without index (unauthenticated)', async () => {
    const res = await request(app)
      .post('/api/search-test/run')
      .send({ q: 'hello' })
    expect(res.status).toBe(401)
  })

  it('rejects request without query (unauthenticated)', async () => {
    const res = await request(app)
      .post('/api/search-test/run')
      .send({ index: 'test' })
    expect(res.status).toBe(401)
  })
})

describe('SearchAdapter contract used by search-test', () => {
  it('Search.search is called with correct parameters', async () => {
    const result = await Search.search({
      index: 'products',
      query: 'headphones',
      limit: 10,
      offset: 0,
    })
    expect(Search.search).toHaveBeenCalledWith({
      index: 'products',
      query: 'headphones',
      limit: 10,
      offset: 0,
    })
    expect(result).toMatchObject({
      hits: expect.any(Array),
      total: 2,
      page: 1,
      totalPages: 1,
    })
  })

  it('Search.search handles sort rules', async () => {
    await Search.search({
      index: 'products',
      query: 'test',
      sort: ['price:asc'],
    })
    expect(Search.search).toHaveBeenCalledWith({
      index: 'products',
      query: 'test',
      sort: ['price:asc'],
    })
  })

  it('Search.search handles filters', async () => {
    await Search.search({
      index: 'products',
      query: 'test',
      filters: 'category = docs',
    })
    expect(Search.search).toHaveBeenCalledWith({
      index: 'products',
      query: 'test',
      filters: 'category = docs',
    })
  })

  it('Search.search handles fields retrieval', async () => {
    await Search.search({
      index: 'products',
      query: 'test',
      attributesToRetrieve: ['id', 'title'],
    })
    expect(Search.search).toHaveBeenCalledWith({
      index: 'products',
      query: 'test',
      attributesToRetrieve: ['id', 'title'],
    })
  })

  it('Search.search handles pagination via offset', async () => {
    const result = await Search.search({
      index: 'products',
      query: 'test',
      limit: 5,
      offset: 10,
    })
    // page = floor(10/5) + 1 = 3
    expect(result.page).toBe(3)
  })

  it('Search.health returns adapter status', async () => {
    const health = await Search.health()
    expect(health).toMatchObject({
      provider: 'none',
      configured: false,
      devMode: true,
    })
  })

  it('Search.healthAll returns status for all adapters', async () => {
    const all = await Search.healthAll()
    expect(all).toHaveProperty('none')
    expect(all).toHaveProperty('meilisearch')
    expect(all).toHaveProperty('algolia')
  })
})