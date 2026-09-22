// @custom — environment configuration system
//
// Centralised env loader with:
//   - Typed coercion (string, number, boolean, url, list)
//   - Defaults per environment (development, test, production)
//   - Required-var validation (fails fast on boot)
//   - Per-environment overrides layered on top of raw process.env
//
// Usage:
//   const env = require('./config/@custom/env')
//   env.PORT               // -> number, e.g. 3001
//   env.DATABASE_URL       // -> string (throws on boot if missing in prod)
//   env.CORS_ORIGINS       // -> string[]
//   env.isProduction       // -> boolean helper
//
// Add or change a variable by editing SCHEMA / ENV_DEFAULTS below.

const NODE_ENV = process.env.NODE_ENV || 'development'
const KNOWN_ENVS = ['development', 'test', 'production']

// ─── Coercers ──────────────────────────────────────────────────────────────
const coercers = {
  string: (v) => String(v),
  number: (v) => {
    const n = Number(v)
    if (Number.isNaN(n)) throw new Error(`expected a number, got "${v}"`)
    return n
  },
  boolean: (v) => {
    const s = String(v).toLowerCase().trim()
    if (['1', 'true', 'yes', 'on'].includes(s)) return true
    if (['0', 'false', 'no', 'off', ''].includes(s)) return false
    throw new Error(`expected boolean, got "${v}"`)
  },
  url: (v) => {
    const s = String(v)
    // eslint-disable-next-line no-new
    new URL(s)
    return s
  },
  list: (v) =>
    String(v)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
}

// ─── Schema ────────────────────────────────────────────────────────────────
// requiredIn: envs where the value MUST be present (no default fallback allowed).
const SCHEMA = {
  NODE_ENV: { type: 'string', default: 'development' },
  PORT: { type: 'number', default: 3001 },
  BIND_HOST: { type: 'string', default: '0.0.0.0' },

  APP_NAME: { type: 'string', default: 'Product Template' },
  APP_URL: { type: 'url', default: 'http://localhost:5173' },
  SERVER_URL: { type: 'url', default: 'http://localhost:3001' },
  SUPPORT_EMAIL: { type: 'string', default: 'support@example.com' },

  DATABASE_URL: { type: 'string', requiredIn: ['production'] },
  DB_POOL_MAX: { type: 'number', default: 20 },
  DB_POOL_IDLE_TIMEOUT: { type: 'number', default: 30000 },
  DB_POOL_CONNECTION_TIMEOUT: { type: 'number', default: 5000 },
  DB_POOL_SSL: { type: 'boolean', default: false },
  DB_SSL_REJECT_UNAUTHORIZED: { type: 'boolean', default: true },

  REDIS_URL: { type: 'string', default: '' },

  JWT_PRIVATE_KEY: { type: 'string', requiredIn: ['production'], default: '' },
  JWT_PUBLIC_KEY: { type: 'string', requiredIn: ['production'], default: '' },

  CORS_ORIGINS: { type: 'list', default: [] },
  SKIP_CSRF: { type: 'boolean', default: false },

  LOG_LEVEL: { type: 'string', default: 'info' },
}

// ─── Per-environment overrides ─────────────────────────────────────────────
// These layer on top of SCHEMA defaults, but process.env still wins.
const ENV_DEFAULTS = {
  development: {
    LOG_LEVEL: 'debug',
    SKIP_CSRF: false,
  },
  test: {
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    JWT_PRIVATE_KEY: 'test-private-key',
    JWT_PUBLIC_KEY: 'test-public-key',
    SKIP_CSRF: true,
  },
  production: {
    LOG_LEVEL: 'info',
    DB_POOL_SSL: true,
    SKIP_CSRF: false,
  },
}

// ─── Loader ────────────────────────────────────────────────────────────────
function load() {
  if (!KNOWN_ENVS.includes(NODE_ENV)) {
    // Unknown env is a warning, not fatal — new envs may exist (staging, ci).
    // eslint-disable-next-line no-console
    console.warn(`[env] unknown NODE_ENV="${NODE_ENV}", falling back to development defaults`)
  }

  const overrides = ENV_DEFAULTS[NODE_ENV] || {}
  const errors = []
  const out = {}

  for (const [key, spec] of Object.entries(SCHEMA)) {
    const raw = process.env[key]
    const hasRaw = raw !== undefined && raw !== ''
    const required = (spec.requiredIn || []).includes(NODE_ENV)

    let value
    if (hasRaw) {
      try {
        value = coercers[spec.type](raw)
      } catch (err) {
        errors.push(`  - ${key}: ${err.message}`)
        continue
      }
    } else if (key in overrides) {
      value = overrides[key]
    } else if ('default' in spec) {
      value = spec.default
    } else if (required) {
      errors.push(`  - ${key}: required in NODE_ENV="${NODE_ENV}" but not set`)
      continue
    } else {
      value = undefined
    }

    if (required && (value === undefined || value === '')) {
      errors.push(`  - ${key}: required in NODE_ENV="${NODE_ENV}" but empty`)
      continue
    }

    out[key] = value
  }

  if (errors.length > 0) {
    throw new Error(
      `Environment configuration invalid (NODE_ENV="${NODE_ENV}"):\n${errors.join('\n')}\n` +
        `Set the missing values in your .env file or environment.`,
    )
  }

  out.isDevelopment = NODE_ENV === 'development'
  out.isTest = NODE_ENV === 'test'
  out.isProduction = NODE_ENV === 'production'

  return Object.freeze(out)
}

// load() returns a frozen object, so `load` / `SCHEMA` are attached to a copy
// before freezing — assigning onto the frozen result throws in strict mode.
module.exports = Object.freeze({ ...load(), load, SCHEMA })
