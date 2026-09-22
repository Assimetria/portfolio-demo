// Unit tests for AccountLockout helpers
// Redis client is fully mocked so no real Redis connection is needed.

jest.mock('../../../src/lib/@system/Redis', () => {
  const store = new Map()
  const expiry = new Map()

  function isExpired(key) {
    const exp = expiry.get(key)
    return exp !== undefined && exp < Date.now()
  }

  const client = {
    get: jest.fn(async (key) => (isExpired(key) ? null : store.get(key) ?? null)),
    set: jest.fn(async (key, value, exFlag, ttlSecs) => {
      store.set(key, value)
      if (exFlag === 'EX') expiry.set(key, Date.now() + ttlSecs * 1000)
    }),
    incr: jest.fn(async (key) => {
      if (isExpired(key)) { store.delete(key); expiry.delete(key) }
      const next = parseInt(store.get(key) ?? '0', 10) + 1
      store.set(key, String(next))
      return next
    }),
    expire: jest.fn(async (key, ttlSecs) => {
      expiry.set(key, Date.now() + ttlSecs * 1000)
    }),
    ttl: jest.fn(async (key) => {
      if (isExpired(key)) return -2
      const exp = expiry.get(key)
      if (!exp) return -1
      return Math.ceil((exp - Date.now()) / 1000)
    }),
    del: jest.fn(async (...keys) => {
      keys.forEach((k) => { store.delete(k); expiry.delete(k) })
    }),
    _store: store,
    _expiry: expiry,
    _reset: () => { store.clear(); expiry.clear() },
  }

  return { client, isReady: () => true }
})

const {
  MAX_ATTEMPTS,
  LOCKOUT_TTL,
  getLockoutSecondsRemaining,
  incrementFailedAttempts,
  getFailedAttemptCount,
  clearFailedAttempts,
} = require('../../../src/lib/@system/AccountLockout')

const { client: redis } = require('../../../src/lib/@system/Redis')

beforeEach(() => {
  redis._reset()
  jest.clearAllMocks()
})

describe('AccountLockout', () => {
  const EMAIL = 'test@example.com'

  it('exports correct defaults', () => {
    expect(MAX_ATTEMPTS).toBe(5)
    expect(LOCKOUT_TTL).toBe(15 * 60)
  })

  describe('getLockoutSecondsRemaining', () => {
    it('returns 0 when no lockout exists', async () => {
      expect(await getLockoutSecondsRemaining(EMAIL)).toBe(0)
    })

    it('returns positive seconds when locked', async () => {
      await redis.set('auth:lockout:' + EMAIL, '1', 'EX', 900)
      const secs = await getLockoutSecondsRemaining(EMAIL)
      expect(secs).toBeGreaterThan(0)
      expect(secs).toBeLessThanOrEqual(900)
    })
  })

  describe('incrementFailedAttempts', () => {
    it('increments the counter on each call', async () => {
      await incrementFailedAttempts(EMAIL)
      expect(await getFailedAttemptCount(EMAIL)).toBe(1)
      await incrementFailedAttempts(EMAIL)
      expect(await getFailedAttemptCount(EMAIL)).toBe(2)
    })

    it('sets a lockout key once MAX_ATTEMPTS is reached', async () => {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        await incrementFailedAttempts(EMAIL)
      }
      const lockedFor = await getLockoutSecondsRemaining(EMAIL)
      expect(lockedFor).toBeGreaterThan(0)
    })

    it('does not lock before MAX_ATTEMPTS', async () => {
      for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
        await incrementFailedAttempts(EMAIL)
      }
      expect(await getLockoutSecondsRemaining(EMAIL)).toBe(0)
    })
  })

  describe('clearFailedAttempts', () => {
    it('removes both the counter and the lockout key', async () => {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        await incrementFailedAttempts(EMAIL)
      }
      expect(await getLockoutSecondsRemaining(EMAIL)).toBeGreaterThan(0)

      await clearFailedAttempts(EMAIL)

      expect(await getLockoutSecondsRemaining(EMAIL)).toBe(0)
      expect(await getFailedAttemptCount(EMAIL)).toBe(0)
    })
  })

  describe('getFailedAttemptCount', () => {
    it('returns 0 when no attempts recorded', async () => {
      expect(await getFailedAttemptCount(EMAIL)).toBe(0)
    })

    it('reflects the current count accurately', async () => {
      await incrementFailedAttempts(EMAIL)
      await incrementFailedAttempts(EMAIL)
      await incrementFailedAttempts(EMAIL)
      expect(await getFailedAttemptCount(EMAIL)).toBe(3)
    })
  })
})
