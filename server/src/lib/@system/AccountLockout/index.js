// @system — account lockout after repeated failed login attempts
// Uses Redis for tracking. Falls back to in-memory when Redis is unavailable
// (bounded map, auto-expiry). Logs a critical warning and alerts operators on
// Redis failure so the degraded state is never silent.

const { client: redis, isReady: redisReady } = require('../Redis')
const logger = require('../Logger')
const Notifications = require('../NotificationAdapter')

const LOCKOUT_PREFIX = 'auth:lockout:'
const ATTEMPTS_PREFIX = 'auth:attempts:'

/** Maximum consecutive failures before the account is locked */
const MAX_ATTEMPTS = 5

/** Lockout window in seconds (also the sliding window for attempts) */
const LOCKOUT_TTL = 15 * 60 // 15 minutes

// ---------------------------------------------------------------------------
// In-memory fallback — active when Redis is down
// ---------------------------------------------------------------------------

/** Maximum number of entries kept in the fallback map (prevents unbounded growth) */
const MAX_FALLBACK_ENTRIES = 1000

/**
 * @type {Map<string, { count: number, lockedUntil: number, windowStart: number }>}
 * Key: email address. Values use Unix-ms timestamps for TTL logic.
 */
const fallback = new Map()

/** Throttle operator alerts: send at most one alert per ALERT_COOLDOWN_MS */
const ALERT_COOLDOWN_MS = 60_000 // 1 minute
let lastAlertAt = 0

/** Log a critical warning and alert operators (throttled) that Redis is down */
function warnRedisDown(context) {
  logger.error({ context }, 'AccountLockout: Redis unavailable — using in-memory fallback. Brute force protection is degraded.')

  const now = Date.now()
  if (now - lastAlertAt >= ALERT_COOLDOWN_MS) {
    lastAlertAt = now
    Notifications.error(
      'Brute force protection degraded',
      'Redis is unavailable. AccountLockout has fallen back to in-memory counters. ' +
      'Lockout state is not shared across instances and will be lost on restart.',
      { context, service: process.env.SERVICE_NAME ?? 'server' }
    ).catch((err) => logger.warn({ err }, 'AccountLockout: failed to send Redis-down alert'))
  }
}

/** Remove expired entries and, if still over capacity, evict oldest by windowStart */
function pruneIfNeeded() {
  const now = Date.now()

  // First pass: remove fully expired entries
  for (const [key, entry] of fallback) {
    const windowExpired = now - entry.windowStart > LOCKOUT_TTL * 1000
    const lockExpired   = entry.lockedUntil > 0 && now > entry.lockedUntil
    if (windowExpired && lockExpired) fallback.delete(key)
  }

  // Second pass: if still over capacity, evict oldest by windowStart
  if (fallback.size >= MAX_FALLBACK_ENTRIES) {
    const sorted = [...fallback.entries()].sort((a, b) => a[1].windowStart - b[1].windowStart)
    const toEvict = fallback.size - MAX_FALLBACK_ENTRIES + 1
    for (let i = 0; i < toEvict; i++) fallback.delete(sorted[i][0])
    logger.warn({ evicted: toEvict }, 'AccountLockout: in-memory fallback at capacity, oldest entries evicted')
  }
}

/** Get or create a fallback entry for the given email */
function getFallbackEntry(email) {
  const now = Date.now()
  const entry = fallback.get(email)
  if (!entry) return null

  // Expire the attempt window
  if (now - entry.windowStart > LOCKOUT_TTL * 1000) {
    fallback.delete(email)
    return null
  }
  return entry
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the number of seconds remaining on the lockout, or 0 if not locked.
 */
async function getLockoutSecondsRemaining(email) {
  if (redisReady()) {
    try {
      const ttl = await redis.ttl(`${LOCKOUT_PREFIX}${email}`)
      return ttl > 0 ? ttl : 0
    } catch {
      // fall through to in-memory fallback below
    }
  }

  warnRedisDown('getLockoutSecondsRemaining')

  const entry = getFallbackEntry(email)
  if (!entry || entry.lockedUntil === 0) return 0
  const remaining = Math.ceil((entry.lockedUntil - Date.now()) / 1000)
  return remaining > 0 ? remaining : 0
}

/**
 * Increments the failed-attempts counter for the email.
 * Locks the account when MAX_ATTEMPTS is reached.
 * NOTE: When ENABLE_TEST_SEED is true (test seed mode on Railway DEV),
 * this function returns early to prevent test users from being locked out.
 */
async function incrementFailedAttempts(email) {
  // Skip lockout accumulation for test users when in test seed mode
  if (process.env.ENABLE_TEST_SEED === 'true') {
    return
  }

  if (redisReady()) {
    try {
      const key = `${ATTEMPTS_PREFIX}${email}`
      const count = await redis.incr(key)
      if (count === 1) await redis.expire(key, LOCKOUT_TTL)
      if (count >= MAX_ATTEMPTS) {
        await redis.set(`${LOCKOUT_PREFIX}${email}`, '1', 'EX', LOCKOUT_TTL)
      }
      return
    } catch {
      // fall through to in-memory fallback below
    }
  }

  warnRedisDown('incrementFailedAttempts')
  pruneIfNeeded()

  const now = Date.now()
  let entry = getFallbackEntry(email)
  if (!entry) {
    entry = { count: 0, lockedUntil: 0, windowStart: now }
    fallback.set(email, entry)
  }

  entry.count += 1
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_TTL * 1000
    logger.warn({ email }, 'AccountLockout: account locked via in-memory fallback')
  }
}

/**
 * Returns current failed-attempt count. Returns null if Redis is unavailable
 * and no fallback entry exists.
 */
async function getFailedAttemptCount(email) {
  if (redisReady()) {
    try {
      const val = await redis.get(`${ATTEMPTS_PREFIX}${email}`)
      return val ? parseInt(val, 10) : 0
    } catch {
      // fall through to in-memory fallback below
    }
  }

  warnRedisDown('getFailedAttemptCount')

  const entry = getFallbackEntry(email)
  return entry ? entry.count : null
}

/**
 * Clears failed-attempt counter and any active lockout for the email.
 * Call this on successful authentication.
 */
async function clearFailedAttempts(email) {
  if (redisReady()) {
    try {
      await redis.del(`${ATTEMPTS_PREFIX}${email}`, `${LOCKOUT_PREFIX}${email}`)
      return
    } catch {
      // fall through to in-memory fallback below
    }
  }

  warnRedisDown('clearFailedAttempts')
  fallback.delete(email)
}

module.exports = {
  MAX_ATTEMPTS,
  LOCKOUT_TTL,
  getLockoutSecondsRemaining,
  incrementFailedAttempts,
  getFailedAttemptCount,
  clearFailedAttempts,
}
