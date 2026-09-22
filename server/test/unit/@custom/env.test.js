const path = require('path')

const ENV_MODULE = path.resolve(__dirname, '../../../src/config/@custom/env.js')

// Jest keeps its own module registry — `delete require.cache[...]` is a no-op
// here, so a fresh evaluation per test needs jest.isolateModules().
function loadFresh(env = {}) {
  const prev = process.env
  process.env = { ...env }
  let mod
  try {
    jest.isolateModules(() => {
      mod = require(ENV_MODULE)
    })
    return mod
  } finally {
    process.env = prev
  }
}

describe('config/@custom/env', () => {
  test('applies defaults in development', () => {
    const env = loadFresh({ NODE_ENV: 'development' })
    expect(env.PORT).toBe(3001)
    expect(env.LOG_LEVEL).toBe('debug')
    expect(env.isDevelopment).toBe(true)
    expect(env.isProduction).toBe(false)
  })

  test('coerces PORT to number', () => {
    const env = loadFresh({ NODE_ENV: 'development', PORT: '4242' })
    expect(env.PORT).toBe(4242)
    expect(typeof env.PORT).toBe('number')
  })

  test('coerces booleans', () => {
    const env = loadFresh({ NODE_ENV: 'development', SKIP_CSRF: 'true' })
    expect(env.SKIP_CSRF).toBe(true)
  })

  test('parses list', () => {
    const env = loadFresh({
      NODE_ENV: 'development',
      CORS_ORIGINS: 'https://a.com, https://b.com',
    })
    expect(env.CORS_ORIGINS).toEqual(['https://a.com', 'https://b.com'])
  })

  test('applies test-environment overrides', () => {
    const env = loadFresh({ NODE_ENV: 'test' })
    expect(env.SKIP_CSRF).toBe(true)
    expect(env.DATABASE_URL).toBe('postgresql://test:test@localhost:5432/test')
    expect(env.isTest).toBe(true)
  })

  test('throws in production when required vars missing', () => {
    expect(() => loadFresh({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL/)
  })

  test('production requires all critical vars set', () => {
    const env = loadFresh({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://prod',
      JWT_PRIVATE_KEY: 'k1',
      JWT_PUBLIC_KEY: 'k2',
    })
    expect(env.isProduction).toBe(true)
    expect(env.DB_POOL_SSL).toBe(true)
  })

  test('throws on invalid number', () => {
    expect(() =>
      loadFresh({ NODE_ENV: 'development', PORT: 'not-a-number' }),
    ).toThrow(/PORT/)
  })

  test('returned config is frozen', () => {
    const env = loadFresh({ NODE_ENV: 'development' })
    expect(() => {
      env.PORT = 9999
    }).toThrow()
  })
})
