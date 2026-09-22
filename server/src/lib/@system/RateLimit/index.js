// @system — rate limiting middleware (general API + per-endpoint limiters)
// Uses express-rate-limit with a Redis-backed store when Redis is available,
// falling back to the default in-memory store for graceful degradation.
//
// Enforcement policy:
//   - NODE_ENV=test / development → limiters are skipped entirely.
//   - Any other environment (production, staging…) → always enforced.
//   - X-Test-Key header bypass for CI is honoured ONLY when TEST_API_KEY is
//     configured, and is compared in constant time.

const crypto = require('crypto')
const rateLimit = require('express-rate-limit')
const { client: redis, isReady: redisReady } = require('../Redis')
const logger = require('../Logger')

/** Constant-time string equality (length leak is acceptable for this use). */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

/**
 * True when the request carries a valid CI bypass key. Requires TEST_API_KEY
 * to be configured — an unset/empty secret never bypasses anything.
 */
function hasTestKeyBypass(req) {
  const testKey = process.env.TEST_API_KEY
  if (!testKey) return false
  const header = req.headers?.['x-test-key']
  return safeEqual(header, testKey)
}

if (process.env.NODE_ENV === 'production' && process.env.TEST_API_KEY && process.env.TEST_API_KEY.length < 32) {
  logger.warn('TEST_API_KEY is shorter than 32 characters — rate-limit bypass key is weak; rotate it')
}

// ── Redis store adapter for express-rate-limit v7 ─────────────────────────
// Implements the Store interface: { increment, decrement, resetKey }

class RedisStore {
  constructor({ prefix, windowMs }) {
    this.prefix = prefix
    this.windowSecs = Math.ceil(windowMs / 1000)
  }

  _key(key) {
    return `${this.prefix}${key}`
  }

  async increment(key) {
    const rKey = this._key(key)
    try {
      // INCR + EXPIRE in a pipeline — atomic enough for rate limiting purposes
      const pipeline = redis.pipeline()
      pipeline.incr(rKey)
      pipeline.ttl(rKey)
      const [[, count], [, ttl]] = await pipeline.exec()

      // Set expiry only on first hit (ttl === -1 means key has no expiry)
      if (ttl === -1) {
        await redis.expire(rKey, this.windowSecs)
      }

      const resetTime = new Date(Date.now() + (ttl === -1 ? this.windowSecs : ttl) * 1000)
      return { totalHits: count, resetTime }
    } catch (err) {
      logger.warn({ err }, 'RateLimit Redis increment failed — skipping')
      // Return a permissive value so the request is not blocked on Redis failure
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowSecs * 1000) }
    }
  }

  async decrement(key) {
    try {
      await redis.decr(this._key(key))
    } catch {
      // best-effort
    }
  }

  async resetKey(key) {
    try {
      await redis.del(this._key(key))
    } catch {
      // best-effort
    }
  }
}

// ── Factory ────────────────────────────────────────────────────────────────

/**
 * Build a rate limiter middleware.
 *
 * @param {object} opts
 * @param {number}  opts.windowMs   - Time window in ms
 * @param {number}  opts.max        - Max requests per window
 * @param {string}  opts.prefix     - Redis key prefix (must be unique per limiter)
 * @param {string}   [opts.message]      - Error message returned on limit exceeded
 * @param {Function} [opts.keyGenerator] - Custom key function (req) => string; defaults to req.ip
 */
function createLimiter({ windowMs, max, prefix, message = 'Too many requests, please try again later.', keyGenerator }) {
  const store = redisReady() ? new RedisStore({ prefix, windowMs }) : undefined

  return rateLimit({
    windowMs,
    max,
    prefix,                   // informational — lets tests/logs identify the limiter
    standardHeaders: true,   // Return RateLimit-* headers (draft-6 format)
    legacyHeaders: true,     // Return X-RateLimit-* headers for client backoff logic
    message: { message },
    store,                    // undefined → default in-memory store
    keyGenerator,             // undefined → default req.ip
    // Skip rate limiting in test and development environments.
    // Deployed environments (including Railway DEV with ENABLE_TEST_SEED) always
    // enforce rate limits so X-RateLimit-* headers are visible for client backoff.
    // X-Test-Key header provides an explicit per-request bypass for CI pipelines
    // and only works when TEST_API_KEY is configured (constant-time compare).
    skip: (req) => {
      if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') return true
      return hasTestKeyBypass(req)
    },
    handler(req, res, next, options) {
      logger.warn(
        { ip: req.ip, path: req.path, prefix },
        `Rate limit exceeded — ${prefix}`
      )
      const retryAfterSecs = Math.ceil(windowMs / 1000)
      res.setHeader('Retry-After', retryAfterSecs)
      res.status(options.statusCode).json(options.message)
    },
  })
}

// ── Named limiters ─────────────────────────────────────────────────────────

/** Login: 5 attempts per minute per IP — brute-force protection */
const loginLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 5,
  prefix: 'rl:login:',
  message: 'Too many login attempts. Please try again in a minute.',
})

/** Register: 3 registrations per hour per IP */
const registerLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  prefix: 'rl:register:',
  message: 'Too many accounts created from this IP. Please try again later.',
})

/** Password reset request + reset: 5 per hour */
const passwordResetLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  prefix: 'rl:password-reset:',
  message: 'Too many password reset attempts. Please try again later.',
})

/** Email verify/request (resend): 5 per hour per authenticated user */
const emailVerifyRequestLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  prefix: 'rl:email-verify-request:',
  message: 'Too many verification email requests. Please try again later.',
  keyGenerator: (req) => req.user?.id ?? req.ip,
})

/** Email verify (token submission): 20 per minute per IP */
const emailVerifyLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 20,
  prefix: 'rl:email-verify:',
  message: 'Too many email verification attempts. Please try again later.',
})

/** Refresh token rotation: 30 per minute — prevents brute-force token rotation */
const refreshLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 30,
  prefix: 'rl:refresh:',
  message: 'Too many token refresh attempts. Please try again later.',
})

/** API key creation: 10 per hour — prevents DB flooding with keys */
const apiKeyLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  prefix: 'rl:api-keys:',
  message: 'Too many API key creation requests. Please try again later.',
})

/** File upload: 20 per minute — prevents DoS via frequent/large uploads */
const uploadLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 20,
  prefix: 'rl:upload:',
  message: 'Too many upload requests. Please try again later.',
})

/** Integration test: 10 per minute — prevents abuse of external service test endpoints */
const integrationTestLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 10,
  prefix: 'rl:integration-test:',
  message: 'Too many integration test requests. Please try again later.',
})

/** General API rate limiter: 100 requests per minute — baseline DoS protection for all endpoints */
const apiLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 100,
  prefix: 'rl:api:',
  message: 'Too many requests. Please slow down and try again later.',
})

/** AI chat endpoints: 20 per minute — prevents cost abuse on expensive LLM API calls */
const aiChatLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 20,
  prefix: 'rl:ai-chat:',
  message: 'AI chat rate limit exceeded. Please slow down.',
})

/** AI image generation: 5 per hour — DALL-E costs $0.04-0.12 per image */
const aiImageLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  prefix: 'rl:ai-image:',
  message: 'Image generation rate limit exceeded. Please try again later.',
})

/** TOTP setup: 5 per hour — prevents QR code generation abuse */
const totpSetupLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  prefix: 'rl:totp-setup:',
  message: 'Too many 2FA setup attempts. Please try again later.',
})

/** TOTP enable/disable: 5 per 10 minutes — prevents brute-force on 6-digit codes */
const totpEnableLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  max: 5,
  prefix: 'rl:totp-enable:',
  message: 'Too many 2FA attempts. Please try again later.',
})

/** Admin read operations: 60 per minute — prevents abuse of expensive queries */
const adminReadLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 60,
  prefix: 'rl:admin-read:',
  message: 'Admin rate limit exceeded.',
})

/** Admin write operations: 10 per minute — tighter control on state-changing operations */
const adminWriteLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 10,
  prefix: 'rl:admin-write:',
  message: 'Admin write rate limit exceeded.',
})

/** Email test endpoint: 10 per hour — prevents email bombing via admin test endpoint */
const emailTestLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  prefix: 'rl:email-test:',
  message: 'Too many test email requests.',
})

/** OAuth endpoints: 20 per minute — prevents redirect loops and state brute-forcing */
const oauthLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 20,
  prefix: 'rl:oauth:',
  message: 'OAuth rate limit exceeded.',
})

/** Data retention cleanup (admin trigger): 5 per minute — prevents hammering purge jobs */
const retentionLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 5,
  prefix: 'rl:retention:',
  message: 'Retention cleanup rate limit exceeded. Please try again later.',
})

module.exports = {
  createLimiter,
  apiLimiter,
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
  emailVerifyRequestLimiter,
  emailVerifyLimiter,
  refreshLimiter,
  apiKeyLimiter,
  uploadLimiter,
  integrationTestLimiter,
  aiChatLimiter,
  aiImageLimiter,
  totpSetupLimiter,
  totpEnableLimiter,
  adminReadLimiter,
  adminWriteLimiter,
  emailTestLimiter,
  oauthLimiter,
  retentionLimiter,
}
