/**
 * Unit tests for the @system RateLimit factory (createLimiter) and the named
 * limiters it wires up — including the retention cleanup limiter added when
 * the retention endpoint shipped.
 *
 * Redis is mocked with isReady() === false so createLimiter exercises the
 * graceful-degradation branch (falls back to express-rate-limit's default
 * in-memory store). express-rate-limit itself is mocked so we can assert the
 * exact options each named limiter passes to the factory.
 */

// ── Capture the options passed to express-rate-limit ──────────────────────
const mockLimiterCalls = []
jest.mock('express-rate-limit', () => (options) => {
  mockLimiterCalls.push(options)
  // Return a drop-in Connect-style middleware for the route under test.
  return function mockRateLimitMiddleware(_req, _res, next) {
    if (typeof next === 'function') return next()
    return undefined
  }
})

// ── Mock Redis (not ready → in-memory store fallback) ─────────────────────
jest.mock('../../../src/lib/@system/Redis', () => ({
  client: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
  },
  isReady: () => false,
}))

const RateLimit = require('../../../src/lib/@system/RateLimit')

/** Find the captured factory options for a given Redis prefix. */
function findOptions(prefix) {
  return mockLimiterCalls.find((opts) => opts.prefix === prefix)
}

describe('createLimiter', () => {
  it('delegates to express-rate-limit with the supplied options', () => {
    const before = mockLimiterCalls.length
    const factory = RateLimit.createLimiter
    const fn = factory({
      windowMs: 5 * 60 * 1000,
      max: 3,
      prefix: 'rl:unit-test:',
      message: 'too fast',
    })

    expect(typeof fn).toBe('function')
    const captured = mockLimiterCalls[mockLimiterCalls.length - 1]
    expect(mockLimiterCalls.length).toBe(before + 1)
    expect(captured.windowMs).toBe(5 * 60 * 1000)
    expect(captured.max).toBe(3)
    expect(captured.prefix).toBe('rl:unit-test:')
    expect(captured.message.message).toBe('too fast')
  })

  it('degrades to the in-memory store when Redis is unavailable', () => {
    const captured = findOptions('rl:unit-test:')
    // isReady() returns false → store must be undefined (express-rate-limit
    // falls back to its built-in memory store).
    expect(captured.store).toBeUndefined()
  })

  it('returns middleware that calls next() immediately (graceful no-op)', () => {
    const next = jest.fn()
    RateLimit.createLimiter({
      windowMs: 1000,
      max: 1,
      prefix: 'rl:noop:',
      message: 'nope',
    })(null, null, next)
    expect(next).toHaveBeenCalledTimes(1)
  })
})

describe('skip logic', () => {
  function originalEnv() {
    return {
      NODE_ENV: process.env.NODE_ENV,
      TEST_API_KEY: process.env.TEST_API_KEY,
    }
  }

  it('skips rate limiting entirely in test/development', () => {
    const snapshot = originalEnv()
    try {
      process.env.NODE_ENV = 'test'
      const captured = findOptions('rl:api:')
      expect(captured.skip({ headers: {} })).toBe(true)
    } finally {
      process.env.NODE_ENV = snapshot.NODE_ENV
    }
  })

  it('honours the X-Test-Key bypass in production-like environments', () => {
    const snapshot = originalEnv()
    try {
      process.env.NODE_ENV = 'production'
      process.env.TEST_API_KEY = 'secret-for-ci'
      const captured = findOptions('rl:api:')
      expect(captured.skip({ headers: { 'x-test-key': 'secret-for-ci' } })).toBe(true)
      expect(captured.skip({ headers: {} })).toBe(false)
    } finally {
      process.env.NODE_ENV = snapshot.NODE_ENV
      process.env.TEST_API_KEY = snapshot.TEST_API_KEY
    }
  })
})

describe('retention limiter', () => {
  it('is exported from the module', () => {
    expect(RateLimit.retentionLimiter).toBeDefined()
    expect(typeof RateLimit.retentionLimiter).toBe('function')
  })

  it('is configured to limit admin cleanup triggers', () => {
    const captured = findOptions('rl:retention:')
    expect(captured).toBeDefined()
    expect(captured.windowMs).toBe(60 * 1000)
    expect(captured.max).toBe(5)
    expect(captured.message.message).toMatch(/retention|Retention/i)
  })
})

describe('module surface', () => {
  it('exposes the documented named limiters', () => {
    const expected = [
      'createLimiter',
      'apiLimiter',
      'loginLimiter',
      'registerLimiter',
      'passwordResetLimiter',
      'emailVerifyRequestLimiter',
      'emailVerifyLimiter',
      'refreshLimiter',
      'apiKeyLimiter',
      'uploadLimiter',
      'integrationTestLimiter',
      'aiChatLimiter',
      'aiImageLimiter',
      'totpSetupLimiter',
      'totpEnableLimiter',
      'adminReadLimiter',
      'adminWriteLimiter',
      'emailTestLimiter',
      'oauthLimiter',
      'retentionLimiter',
    ]
    for (const name of expected) {
      expect(typeof RateLimit[name]).toBe('function')
    }
  })
})
