// @custom — Unit tests for caching-research module
//
// Tests for the caching strategy definitions and the recommend() function
// which selects the best caching strategy based on environment context.

const {
  strategies,
  recommend,
} = require('../../../src/lib/@custom/caching-research')

// ─── Required field schema ────────────────────────────────────────────────────

const REQUIRED_FIELDS = [
  'id',
  'name',
  'category',
  'description',
  'pros',
  'cons',
  'freshness',
  'complexity',
  'infraCost',
  'requiresRedis',
  'useCase',
]

const VALID_CATEGORIES = ['client', 'server', 'infra']

describe('caching-research — strategies array', () => {
  it('exports an array of 6 strategies', () => {
    expect(Array.isArray(strategies)).toBe(true)
    expect(strategies).toHaveLength(6)
  })

  it.each(strategies)('$id has all required fields', (strategy) => {
    for (const field of REQUIRED_FIELDS) {
      expect(strategy).toHaveProperty(field)
    }
  })

  it.each(strategies)('$id has a valid category', (strategy) => {
    expect(VALID_CATEGORIES).toContain(strategy.category)
  })

  it.each(strategies)('$id has a string id', (strategy) => {
    expect(typeof strategy.id).toBe('string')
    expect(strategy.id.length).toBeGreaterThan(0)
  })

  it.each(strategies)('$id has a non-empty pros array', (strategy) => {
    expect(Array.isArray(strategy.pros)).toBe(true)
    expect(strategy.pros.length).toBeGreaterThan(0)
    for (const pro of strategy.pros) {
      expect(typeof pro).toBe('string')
    }
  })

  it.each(strategies)('$id has a non-empty cons array', (strategy) => {
    expect(Array.isArray(strategy.cons)).toBe(true)
    expect(strategy.cons.length).toBeGreaterThan(0)
    for (const con of strategy.cons) {
      expect(typeof con).toBe('string')
    }
  })

  it.each(strategies)('$id has numeric ratings between 1 and 5', (strategy) => {
    expect(strategy.freshness).toBeGreaterThanOrEqual(1)
    expect(strategy.freshness).toBeLessThanOrEqual(5)
    expect(strategy.complexity).toBeGreaterThanOrEqual(1)
    expect(strategy.complexity).toBeLessThanOrEqual(5)
    expect(strategy.infraCost).toBeGreaterThanOrEqual(1)
    expect(strategy.infraCost).toBeLessThanOrEqual(5)
  })
})
it('all strategy IDs are unique', () => {
    const ids = strategies.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('includes all expected strategy IDs', () => {
    const ids = strategies.map((s) => s.id).sort()
    expect(ids).toEqual([
      'db-cache',
      'http-cache',
      'in-memory',
      'redis-cache',
      'swr-client',
      'swr-server',
    ])
  })

  it('redis-cache strategy requires Redis', () => {
    const redis = strategies.find((s) => s.id === 'redis-cache')
    expect(redis.requiresRedis).toBe(true)
  })

  it('non-redis strategies do not require Redis', () => {
    const nonRedis = strategies.filter((s) => s.id !== 'redis-cache')
    for (const s of nonRedis) {
      expect(s.requiresRedis).toBe(false)
    }
  })

// ─── recommend() ──────────────────────────────────────────────────────────────

describe('caching-research — recommend()', () => {
  describe('with explicit env parameters', () => {
    it('returns redis-cache primary when hasRedis=true and isMultiProcess=true', () => {
      const result = recommend({ hasRedis: true, isMultiProcess: true })
      expect(result.primary.id).toBe('redis-cache')
      expect(result.secondary.id).toBe('swr-client')
      expect(result.fallback.id).toBe('in-memory')
    })

    it('returns swr-client primary when hasRedis=false and isMultiProcess=true', () => {
      const result = recommend({ hasRedis: false, isMultiProcess: true })
      expect(result.primary.id).toBe('swr-client')
      expect(result.secondary.id).toBe('http-cache')
      expect(result.fallback.id).toBe('in-memory')
    })

    it('returns in-memory primary when isMultiProcess=false (single process)', () => {
      const result = recommend({ hasRedis: true, isMultiProcess: false })
      expect(result.primary.id).toBe('in-memory')
      expect(result.secondary.id).toBe('swr-client')
      expect(result.fallback.id).toBe('swr-server')
    })

    it('returns in-memory primary when hasRedis=false and isMultiProcess=false', () => {
      const result = recommend({ hasRedis: false, isMultiProcess: false })
      expect(result.primary.id).toBe('in-memory')
      expect(result.secondary.id).toBe('swr-client')
      expect(result.fallback.id).toBe('swr-server')
    })
  })

  describe('with environment variables (NODE_ENV / REDIS_URL)', () => {
    const OLD_ENV = { ...process.env }

    afterEach(() => {
      process.env = { ...OLD_ENV }
    })

    it('defaults to single-process when NODE_ENV is development', () => {
      process.env.NODE_ENV = 'development'
      delete process.env.REDIS_URL
      const result = recommend()
      expect(result.primary.id).toBe('in-memory')
    })

    it('defaults to multi-process when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production'
      delete process.env.REDIS_URL
      const result = recommend()
      expect(result.primary.id).toBe('swr-client')
    })

    it('uses REDIS_URL to determine hasRedis', () => {
      process.env.NODE_ENV = 'production'
      process.env.REDIS_URL = 'redis://localhost:6379'
      const result = recommend()
      expect(result.primary.id).toBe('redis-cache')
    })

    it('respects explicit env parameter over process.env', () => {
      process.env.REDIS_URL = 'redis://localhost:6379'
      process.env.NODE_ENV = 'production'
      // Explicitly override with hasRedis=false — should ignore REDIS_URL
      const result = recommend({ hasRedis: false, isMultiProcess: true })
      expect(result.primary.id).toBe('swr-client')
    })
  })

  describe('return value shape', () => {
    it('returns an object with primary, secondary, and fallback', () => {
it('primary, secondary, and fallback have distinct IDs', () => {
      const result = recommend({ hasRedis: false, isMultiProcess: false })
      const ids = [result.primary.id, result.secondary.id, result.fallback.id]
      expect(new Set(ids).size).toBe(3)
    })

    it('returns the same strategy shape for every env combination', () => {
      const envs = [
        { hasRedis: true, isMultiProcess: true },
        { hasRedis: false, isMultiProcess: true },
        { hasRedis: true, isMultiProcess: false },
        { hasRedis: false, isMultiProcess: false },
      ]
      for (const env of envs) {
        const result = recommend(env)
        expect(result.primary).toBeDefined()
        expect(typeof result.primary.id).toBe('string')
        expect(result.secondary).toBeDefined()
        expect(typeof result.secondary.id).toBe('string')
        expect(result.fallback).toBeDefined()
        expect(typeof result.fallback.id).toBe('string')
        expect(typeof result.primary.name).toBe('string')
        expect(typeof result.primary.description).toBe('string')
      }
    })
  })

  describe('edge cases', () => {
    it('handles undefined env gracefully (falls back to process.env)', () => {
      const OLD_ENV = { ...process.env }
      process.env.NODE_ENV = 'development'
      delete process.env.REDIS_URL
      expect(() => recommend()).not.toThrow()
      const result = recommend()
      expect(result.primary).toBeDefined()
      process.env = OLD_ENV
    })

    it('handles null env gracefully', () => {
      expect(() => recommend(null)).not.toThrow()
      const result = recommend(null)
      expect(result.primary).toBeDefined()
    })

    it('handles empty object env', () => {
      const result = recommend({})
      expect(result.primary).toBeDefined()
      expect(result.secondary).toBeDefined()
      expect(result.fallback).toBeDefined()
    })
  })
})
      const result = recommend({ hasRedis: false, isMultiProcess: false })
      expect(result).toHaveProperty('primary')
      expect(result).toHaveProperty('secondary')
      expect(result).toHaveProperty('fallback')
    })

    it('each returned strategy is a valid strategy object', () => {
      const result = recommend({ hasRedis: false, isMultiProcess: false })
      for (const key of ['primary', 'secondary', 'fallback']) {
        const s = result[key]
        expect(s).toBeDefined()
        expect(typeof s.id).toBe('string')
        expect(typeof s.name).toBe('string')
        expect(VALID_CATEGORIES).toContain(s.category)
      }
    })
  })
})
  it.each(strategies)('$id has boolean requiresRedis', (strategy) => {
    expect(typeof strategy.requiresRedis).toBe('boolean')
  })
})