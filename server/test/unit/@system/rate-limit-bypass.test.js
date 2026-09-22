'use strict'

// Unit tests for the rate-limiter enforcement/bypass policy: enforced in every
// non test/dev environment, X-Test-Key bypass only with a configured secret.

const mockLimiterCalls = []
jest.mock('express-rate-limit', () => (options) => {
  mockLimiterCalls.push(options)
  return (_req, _res, next) => next && next()
})

jest.mock('../../../src/lib/@system/Redis', () => ({
  client: {},
  isReady: () => false,
}))

jest.mock('../../../src/lib/@system/Logger', () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }))

const RateLimit = require('../../../src/lib/@system/RateLimit')

const apiOpts = () => mockLimiterCalls.find((o) => o.prefix === 'rl:api:')

function withEnv(env, fn) {
  const snapshot = { NODE_ENV: process.env.NODE_ENV, TEST_API_KEY: process.env.TEST_API_KEY }
  Object.assign(process.env, env)
  for (const k of Object.keys(env)) if (env[k] === undefined) delete process.env[k]
  try { return fn() } finally {
    for (const [k, v] of Object.entries(snapshot)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}

describe('rate limit enforcement policy', () => {
  it('is skipped in test and development', () => {
    withEnv({ NODE_ENV: 'test' }, () => expect(apiOpts().skip({ headers: {} })).toBe(true))
    withEnv({ NODE_ENV: 'development' }, () => expect(apiOpts().skip({ headers: {} })).toBe(true))
  })

  it('is enforced in production and staging', () => {
    withEnv({ NODE_ENV: 'production', TEST_API_KEY: undefined }, () => expect(apiOpts().skip({ headers: {} })).toBe(false))
    withEnv({ NODE_ENV: 'staging', TEST_API_KEY: undefined }, () => expect(apiOpts().skip({ headers: {} })).toBe(false))
  })

  it('never bypasses when TEST_API_KEY is unset or empty', () => {
    withEnv({ NODE_ENV: 'production', TEST_API_KEY: undefined }, () => {
      expect(apiOpts().skip({ headers: { 'x-test-key': '' } })).toBe(false)
      expect(apiOpts().skip({ headers: { 'x-test-key': 'undefined' } })).toBe(false)
    })
    withEnv({ NODE_ENV: 'production', TEST_API_KEY: '' }, () => {
      expect(apiOpts().skip({ headers: { 'x-test-key': '' } })).toBe(false)
    })
  })

  it('bypasses only on an exact match of the configured secret', () => {
    withEnv({ NODE_ENV: 'production', TEST_API_KEY: 'ci-secret-key-0123456789abcdef' }, () => {
      expect(apiOpts().skip({ headers: { 'x-test-key': 'ci-secret-key-0123456789abcdef' } })).toBe(true)
      expect(apiOpts().skip({ headers: { 'x-test-key': 'ci-secret-key-0123456789abcdeF' } })).toBe(false)
      expect(apiOpts().skip({ headers: { 'x-test-key': 'ci-secret-key' } })).toBe(false)
      expect(apiOpts().skip({ headers: { 'x-test-key': ['ci-secret-key-0123456789abcdef'] } })).toBe(false)
      expect(apiOpts().skip({ headers: {} })).toBe(false)
    })
  })

  it('wires the general API limiter and the auth limiters', () => {
    expect(typeof RateLimit.apiLimiter).toBe('function')
    for (const prefix of ['rl:api:', 'rl:login:', 'rl:register:', 'rl:password-reset:', 'rl:refresh:']) {
      expect(mockLimiterCalls.find((o) => o.prefix === prefix)).toBeDefined()
    }
  })
})
