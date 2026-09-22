/**
 * API tests for /api/notification-uploads (@custom)
 *
 * External deps (DB, Redis, Email, StorageAdapter) are mocked so the suite
 * runs in CI without any external services.
 */

const request = require('supertest')
const crypto = require('crypto')

// ── Mock PostgreSQL with smart user lookup ────────────────────────────────
const _defaultUser = { id: 1, email: 'test@example.com', name: 'Test User', role: 'user' }
const mockDb = {
  _reset() {},
  one: jest.fn(),
  oneOrNone: jest.fn(),
  none: jest.fn(),
  any: jest.fn(),
  result: jest.fn(),
  tx: jest.fn(async (fn) => fn(mockDb)),
}
// Default: return user for queries on users table, null for anything else
mockDb.oneOrNone.mockImplementation((query) => {
  if (query && typeof query === 'string' && query.toLowerCase().includes('from users')) {
    return Promise.resolve(_defaultUser)
  }
  return Promise.resolve(null)
})
jest.mock('../../../src/lib/@system/PostgreSQL', () => mockDb)