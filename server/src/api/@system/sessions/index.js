// @system — session management API
// POST   /api/sessions          — login
// POST   /api/sessions/refresh  — rotate refresh token / re-issue access token
// GET    /api/sessions/me       — current user
// GET    /api/sessions          — list all active sessions for the current user
// DELETE /api/sessions/:id      — revoke a specific session by ID
// DELETE /api/sessions          — logout (revoke current session)
const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const { authenticate, extractAccessToken, toPublicUser, looksLikeJwt } = require('../../../lib/@system/Helpers/auth')
const { completeLogin } = require('../../../lib/@system/Helpers/loginFlow')
const { requireCsrfPresence } = require('../../../lib/@system/Middleware/csrf')
const UserRepo = require('../../../db/repos/@system/UserRepo')
const RefreshTokenRepo = require('../../../db/repos/@system/RefreshTokenRepo')
const SessionRepo = require('../../../db/repos/@system/SessionRepo')
const { signAccessTokenAsync, verifyTokenAsync } = require('../../../lib/@system/Helpers/jwt')
const bcrypt = require('bcryptjs')
const { client: redis, isReady: redisReady } = require('../../../lib/@system/Redis')
const { loginLimiter, refreshLimiter, registerLimiter } = require('../../../lib/@system/RateLimit')
const { validate } = require('../../../lib/@system/Validation')
const { LoginBody, RegisterBody, DeleteSessionParams } = require('../../../lib/@system/Validation/schemas/@system/sessions')
const {
  MAX_ATTEMPTS,
  getLockoutSecondsRemaining,
  incrementFailedAttempts,
  getFailedAttemptCount,
  clearFailedAttempts,
} = require('../../../lib/@system/AccountLockout')

const { setAccessCookie, setRefreshCookie, ACCESS_TOKEN_TTL_MS, REFRESH_TOKEN_TTL_MS } = require('../../../lib/@system/Helpers/cookies')
const { requireModule, SELF_REGISTRATION_DISABLED_MESSAGE } = require('../../../lib/@system/Helpers/modules')
const BLACKLIST_PREFIX = 'session:blacklist:'

// brand.json modules.selfRegistration — see api/@system/auth for the rationale.
const requireSelfRegistration = requireModule('selfRegistration', SELF_REGISTRATION_DISABLED_MESSAGE)

/** SHA-256 hash a raw token string. */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/** Check if an error is a database connection error */
function isDbConnectionError(err) {
  const msg = (err.message || '').toLowerCase()
  return (
    msg.includes('connection terminated') ||
    msg.includes('connection refused') ||
    msg.includes('connection timeout') ||
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    err.code === 'ECONNREFUSED' ||
    err.code === 'ECONNRESET' ||
    err.code === 'ETIMEDOUT'
  )
}

// ── Token blacklist helpers ────────────────────────────────────────────────

/**
 * Add an access token to the Redis blacklist (valid until it expires naturally).
 * Graceful degradation: if Redis is unavailable the token stays valid until expiry.
 */
async function blacklistAccessToken(token) {
  if (!redisReady()) return
  try {
    const payload = await verifyTokenAsync(token)
    const ttl = payload.exp ? payload.exp - Math.floor(Date.now() / 1000) : 0
    if (ttl > 0) {
      await redis.set(`${BLACKLIST_PREFIX}${token}`, '1', 'EX', ttl)
    }
  } catch {
    // token already expired or invalid — nothing to blacklist
  }
}

/**
 * Returns true when the access token has been explicitly invalidated.
 */
async function isBlacklisted(token) {
  if (!redisReady()) return false
  try {
    return (await redis.exists(`${BLACKLIST_PREFIX}${token}`)) === 1
  } catch {
    return false
  }
}

// ── Cookie helpers ─────────────────────────────────────────────────────────

function clearAuthCookies(res) {
  res.clearCookie('access_token', { path: '/' })
  res.clearCookie('refresh_token', { path: '/api/sessions' })
  res.clearCookie('token', { path: '/' }) // legacy cookie — backward compat
}

/** Max lifetime of a session family (30 days) — matches auth.js */
const SESSION_FAMILY_MAX_MS = 30 * 24 * 60 * 60 * 1000

// ── Routes ─────────────────────────────────────────────────────────────────

// POST /api/sessions/register — create a new account
// Module gate as its own route (runs first; handler line stays identical to upstream).
router.post('/sessions/register', requireSelfRegistration)
router.post('/sessions/register', requireCsrfPresence, registerLimiter, validate({ body: RegisterBody }), async (req, res, next) => {
  try {
    const { email, password, name } = req.body

    const normalizedEmail = email.toLowerCase()

    // Check if user already exists
    const existing = await UserRepo.findByEmail(normalizedEmail)
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists' })
    }

    // Hash password and create user
    const password_hash = await bcrypt.hash(password, 12)
    const user = await UserRepo.create({ email: normalizedEmail, name: name || null, password_hash })

    // Issue tokens immediately (auto-login after registration)
    const accessToken = await signAccessTokenAsync({ userId: user.id })
    const { token: refreshToken, record: refreshRecord } = await RefreshTokenRepo.create({ userId: user.id })

    // Persist session record (matches login flow) so refresh rotation and
    // the "Active Sessions" list in settings work correctly after signup.
    await SessionRepo.create({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      ipAddress: req.ip ?? req.headers['x-forwarded-for'] ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      expiresAt: refreshRecord.expires_at,
    }).catch(() => {}) // fire-and-forget — don't block registration if session insert fails

    setAccessCookie(res, accessToken)
    setRefreshCookie(res, refreshToken)

    res.status(201).json({ user: toPublicUser(user) })
  } catch (err) {
    if (isDbConnectionError(err)) {
      return res.status(503).json({ message: 'Service temporarily unavailable. Please try again later.' })
    }
    next(err)
  }
})

// POST /api/sessions — login
// CSRF enforced (#38791) — login requires CSRF token to prevent login-CSRF attacks.
// Token issuance (incl. the TOTP second-factor gate) is shared with POST /api/auth/login via
// Helpers/loginFlow.completeLogin so both routes enforce 2FA identically.
router.post('/sessions', requireCsrfPresence, loginLimiter, validate({ body: LoginBody }), async (req, res, next) => {
  try {
    const { email, password, totpCode, rememberMe } = req.body

    const normalizedEmail = email.toLowerCase()

    // Check account lockout before doing any DB work
    const lockedFor = await getLockoutSecondsRemaining(normalizedEmail)
    if (lockedFor > 0) {
      const minutes = Math.ceil(lockedFor / 60)
      return res.status(429).json({
        message: `Account temporarily locked due to too many failed login attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
        lockedFor,
      })
    }

    const user = await UserRepo.findByEmail(normalizedEmail)
    if (!user) {
      // Increment attempts even for unknown emails to prevent timing-based enumeration
      await incrementFailedAttempts(normalizedEmail)
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    // OAuth-only users have no password_hash — reject gracefully instead of
    // letting bcrypt.compare throw on null (which causes a 500).
    if (!user.password_hash) {
      await incrementFailedAttempts(normalizedEmail)
      return res.status(401).json({ message: 'This account uses social login. Please sign in with Google or GitHub.' })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      await incrementFailedAttempts(normalizedEmail)
      // Warn when the user is close to being locked out
      const count = await getFailedAttemptCount(normalizedEmail)
      const remaining = count !== null ? MAX_ATTEMPTS - count : null
      const extra =
        remaining !== null && remaining > 0 && remaining <= 2
          ? ` ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before account lockout.`
          : ''
      return res.status(401).json({ message: `Invalid credentials.${extra}` })
    }

    // Successful login — clear lockout state
    await clearFailedAttempts(normalizedEmail)

    // 2FA gate + token issuance (shared with /api/auth/login)
    await completeLogin(req, res, user, { totpCode, rememberMe })
  } catch (err) {
    if (isDbConnectionError(err)) {
      return res.status(503).json({ message: 'Service temporarily unavailable. Please try again later.' })
    }
    next(err)
  }
})

// POST /api/sessions/refresh — rotate refresh token and issue a new access token
router.post('/sessions/refresh', refreshLimiter, async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refresh_token
    if (!refreshToken) return res.status(401).json({ message: 'No refresh token' })

    // Look up by hash regardless of revocation state (needed for reuse detection)
    const record = await RefreshTokenRepo.findByHash(refreshToken)

    if (!record) {
      return res.status(401).json({ message: 'Invalid refresh token' })
    }

    if (record.revoked_at) {
      // Token reuse detected — invalidate the entire family (all derived sessions)
      await RefreshTokenRepo.revokeFamilyById(record.family_id)
      clearAuthCookies(res)
      return res.status(401).json({ message: 'Refresh token reuse detected. Please log in again.' })
    }

    if (new Date(record.expires_at) <= new Date()) {
      clearAuthCookies(res)
      return res.status(401).json({ message: 'Refresh token expired' })
    }

    const user = await UserRepo.findById(record.user_id)
    if (!user) {
      clearAuthCookies(res)
      return res.status(401).json({ message: 'User not found' })
    }

    // Rotate: revoke old token, issue new pair in same family
    const { token: newRefreshToken, record: newRefreshRecord } = await RefreshTokenRepo.rotate(record)
    const newAccessToken = await signAccessTokenAsync({ userId: user.id })

    // Keep the session row in sync with the new refresh token hash
    await SessionRepo.updateTokenHash(
      user.id,
      record.token_hash,          // old hash stored in sessions table
      hashToken(newRefreshToken),  // new hash
      newRefreshRecord.expires_at,
    ).catch(() => {}) // fire-and-forget

    setAccessCookie(res, newAccessToken)
    setRefreshCookie(res, newRefreshToken)

    res.json({ user: { id: user.id, email: user.email, name: user.name } })
  } catch (err) {
    next(err)
  }
})

// GET /api/sessions/me — current user (soft auth)
// Returns 200 with { user: null } for unauthenticated requests instead of 401.
// This prevents "Failed to load resource: 401" browser console errors on public pages
// where AuthProvider checks the session on every page load (#33469).
// If the access token is expired but a valid refresh token exists, auto-rotates tokens.
router.get('/sessions/me', async (req, res, next) => {
  try {
    const rawToken = extractAccessToken(req)

    if (rawToken) {
      // Check blacklist first
      if (await isBlacklisted(rawToken)) {
        return res.json({ user: null })
      }

      // JWT access token
      if (looksLikeJwt(rawToken)) {
        try {
          const payload = await verifyTokenAsync(rawToken)
          const user = await UserRepo.findById(payload.userId)
          if (user) return res.json({ user: toPublicUser(user) })
        } catch {
          // Expired or invalid JWT — fall through to refresh token
        }
      }

      // Opaque session token (96-hex)
      if (/^[0-9a-f]{96}$/.test(rawToken)) {
        const session = await SessionRepo.findActiveWithUser(hashToken(rawToken))
        if (session) {
          const familyAgeMs = session.family_created_at
            ? Date.now() - new Date(session.family_created_at).getTime()
            : Infinity
          if (session.family_created_at && familyAgeMs <= SESSION_FAMILY_MAX_MS) {
            return res.json({
              user: {
                id: session.user_id,
                email: session.email,
                name: session.name,
                role: session.role,
                emailVerified: !!session.email_verified_at,
                onboardingCompleted: !!session.onboarding_completed,
              },
            })
          }
        }
      }
    }

    // No valid access token — try refresh token for seamless re-auth
    const refreshToken = req.cookies?.refresh_token
    if (refreshToken) {
      const record = await RefreshTokenRepo.findByHash(refreshToken)
      if (record && !record.revoked_at && new Date(record.expires_at) > new Date()) {
        const user = await UserRepo.findById(record.user_id)
        if (user) {
          const { token: newRefreshToken, record: newRefreshRecord } = await RefreshTokenRepo.rotate(record)
          const newAccessToken = await signAccessTokenAsync({ userId: user.id })
          await SessionRepo.updateTokenHash(
            user.id,
            record.token_hash,
            hashToken(newRefreshToken),
            newRefreshRecord.expires_at,
          ).catch(() => {})
          setAccessCookie(res, newAccessToken)
          setRefreshCookie(res, newRefreshToken)
          return res.json({ user: toPublicUser(user) })
        }
      }
    }

    // Not authenticated
    return res.json({ user: null })
  } catch (err) {
    next(err)
  }
})

// GET /api/sessions — list all active sessions for the authenticated user
router.get('/sessions', authenticate, async (req, res, next) => {
  try {
    const currentRefreshToken = req.cookies?.refresh_token
    const currentHash = currentRefreshToken ? hashToken(currentRefreshToken) : null

    const rows = await SessionRepo.findActiveByUserId(req.user.id)

    const sessions = rows.map((s) => ({
      id: s.id,
      ipAddress: s.ip_address,
      userAgent: s.user_agent,
      createdAt: s.created_at,
      expiresAt: s.expires_at,
      isCurrent: currentHash ? s.token_hash === currentHash : false,
    }))

    res.json({ sessions })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/sessions/:id — revoke a specific session by ID
router.delete('/sessions/:id', authenticate, validate({ params: DeleteSessionParams }), async (req, res, next) => {
  try {
    const sessionId = req.params.id

    // Revoke in sessions table and get back the token_hash to revoke the refresh token too
    const revoked = await SessionRepo.revoke(sessionId, req.user.id)
    if (!revoked) return res.status(404).json({ message: 'Session not found or already revoked' })

    // Also revoke the underlying refresh token so token rotation can't revive it
    await RefreshTokenRepo.revokeByTokenHashDirect(revoked.token_hash).catch(() => {})

    res.json({ message: 'Session revoked' })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/sessions — logout (blacklist access token + revoke refresh token + revoke session row)
router.delete('/sessions', async (req, res) => {
  const accessToken = extractAccessToken(req)
  const refreshToken = req.cookies?.refresh_token

  if (accessToken) await blacklistAccessToken(accessToken)

  if (refreshToken) {
    const record = await RefreshTokenRepo.findByHash(refreshToken).catch(() => null)
    if (record && !record.revoked_at) {
      await RefreshTokenRepo.revokeById(record.id)
    }
    // Revoke the corresponding session row
    await SessionRepo.revokeByTokenHash(hashToken(refreshToken)).catch(() => {})
  }

  clearAuthCookies(res)
  res.json({ message: 'Logged out' })
})

module.exports = router
