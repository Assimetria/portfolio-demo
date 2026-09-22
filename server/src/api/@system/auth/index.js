// @system — auth API (aliases to sessions for backward compatibility)
// POST   /api/auth/register         — create account
// POST   /api/sessions/register     — alias for /api/auth/register (QA journey path, legacy clients)
// POST   /api/auth/login            — login
// GET    /api/auth/me               — current user
// POST   /api/auth/forgot-password  — request password reset
// POST   /api/auth/reset-password   — reset password with token
const crypto = require('crypto')
const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const { authenticate, extractAccessToken, toPublicUser } = require('../../../lib/@system/Helpers/auth')
const { completeLogin } = require('../../../lib/@system/Helpers/loginFlow')
const { requireCsrfPresence } = require('../../../lib/@system/Middleware/csrf')
const UserRepo = require('../../../db/repos/@system/UserRepo')
const RefreshTokenRepo = require('../../../db/repos/@system/RefreshTokenRepo')
const SessionRepo = require('../../../db/repos/@system/SessionRepo')
const { signAccessTokenAsync } = require('../../../lib/@system/Helpers/jwt')
const { loginLimiter, registerLimiter, passwordResetLimiter } = require('../../../lib/@system/RateLimit')
const { validate } = require('../../../lib/@system/Validation')
const { LoginBody, RegisterBody } = require('../../../lib/@system/Validation/schemas/@system/sessions')
const { ForgotPasswordBody, ResetPasswordBody } = require('../../../lib/@system/Validation/schemas/@system/auth')
const {
  MAX_ATTEMPTS,
  getLockoutSecondsRemaining,
  incrementFailedAttempts,
  getFailedAttemptCount,
  clearFailedAttempts,
} = require('../../../lib/@system/AccountLockout')
const { setAccessCookie, setRefreshCookie } = require('../../../lib/@system/Helpers/cookies')
const Email = require('../../../lib/@system/Email')
const { requireModule, SELF_REGISTRATION_DISABLED_MESSAGE } = require('../../../lib/@system/Helpers/modules')

// Public self-registration is a feature module (brand.json modules.selfRegistration).
// The auth router itself is always mounted (login/reset must work); only the
// account-creation endpoint answers 403 when the module is off. Admins still
// provision accounts via POST /api/users/provision.
const requireSelfRegistration = requireModule('selfRegistration', SELF_REGISTRATION_DISABLED_MESSAGE)

/** SHA-256 hash a raw token string. */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

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

// POST /api/auth/register
// Module gate registered as its own route so it runs before CSRF/rate-limit
// and the handler line below stays byte-identical to upstream.
router.post('/auth/register', requireSelfRegistration)
router.post('/auth/register', requireCsrfPresence, registerLimiter, validate({ body: RegisterBody }), async (req, res, next) => {
  try {
    const { email, password, name } = req.body

    const normalizedEmail = email.toLowerCase()

    const existing = await UserRepo.findByEmail(normalizedEmail)
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists' })
    }

    const password_hash = await bcrypt.hash(password, 12)
    const user = await UserRepo.create({ email: normalizedEmail, name: name || null, password_hash })

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

// GET /api/auth/login — return 401 for unauthenticated (Pacekit/SendVerb parity)
router.get('/auth/login', authenticate, (req, res) => {
  res.json({ authenticated: true, userId: req.user.id })
})

// POST /api/auth/login
// CSRF enforced (#38791) — login requires X-CSRF-Token header + double-submit cookie.
// Matches SendVerb and Pacekit CSRF enforcement on login.
// Token issuance (incl. the TOTP second-factor gate) is shared with POST /api/sessions via
// Helpers/loginFlow.completeLogin so both routes enforce 2FA identically.
router.post('/auth/login', requireCsrfPresence, loginLimiter, validate({ body: LoginBody }), async (req, res, next) => {
  try {
    const { email, password, rememberMe, totpCode } = req.body
    const normalizedEmail = email.toLowerCase()

    const lockedFor = await getLockoutSecondsRemaining(normalizedEmail)
    if (lockedFor > 0) {
      const minutes = Math.ceil(lockedFor / 60)
      return res.status(429).json({
        message: `Account temporarily locked. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
        lockedFor,
      })
    }

    const user = await UserRepo.findByEmail(normalizedEmail)
    if (!user) {
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
      const count = await getFailedAttemptCount(normalizedEmail)
      const remaining = count !== null ? MAX_ATTEMPTS - count : null
      const extra =
        remaining !== null && remaining > 0 && remaining <= 2
          ? ` ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before account lockout.`
          : ''
      return res.status(401).json({ message: `Invalid credentials.${extra}` })
    }

    await clearFailedAttempts(normalizedEmail)

    await completeLogin(req, res, user, { totpCode, rememberMe })
  } catch (err) {
    if (isDbConnectionError(err)) {
      return res.status(503).json({ message: 'Service temporarily unavailable. Please try again later.' })
    }
    next(err)
  }
})

// GET /api/auth/me
router.get('/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user })
})

// Field pre-checks — these exact 400 messages are pinned by test/api/@system/password-reset.test.js,
// so they must run BEFORE validate() (which replies with a generic 'Validation failed').
function requireEmailField(req, res, next) {
  const email = req.body && req.body.email
  if (!email) return res.status(400).json({ message: 'Email is required' })
  next()
}

function requireResetFields(req, res, next) {
  const { token, password } = req.body || {}
  if (!token || !password) {
    return res.status(400).json({ message: 'Token and new password are required' })
  }
  if (typeof password === 'string' && password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' })
  }
  next()
}

// POST /api/auth/forgot-password (stub — sends password reset email)
router.post('/auth/forgot-password', passwordResetLimiter, requireEmailField, validate({ body: ForgotPasswordBody }), async (req, res, next) => {
  try {
    const { email } = req.body

    // Always return success to prevent email enumeration
    const normalizedEmail = email.toLowerCase()
    const user = await UserRepo.findByEmail(normalizedEmail)

    if (user) {
      const token = crypto.randomBytes(32).toString('hex')
      const db = require('../../../lib/@system/PostgreSQL')
      await db.none(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at)
         VALUES ($1, $2, now() + INTERVAL '1 hour')`,
        [user.id, token],
      )
      // @sync-guard:password-reset-email — DO NOT revert to console.log (fix #39089, #37324, #35927)
      Email.sendPasswordResetEmail({ to: normalizedEmail, name: user.name, token, userId: user.id }).catch(() => {})
      // @end-sync-guard
    }

    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' })
  } catch (err) {
    if (isDbConnectionError(err)) {
      return res.status(503).json({ message: 'Service temporarily unavailable. Please try again later.' })
    }
    next(err)
  }
})

// POST /api/auth/reset-password (stub — resets password with token)
router.post('/auth/reset-password', passwordResetLimiter, requireResetFields, validate({ body: ResetPasswordBody }), async (req, res, next) => {
  try {
    const { token, password } = req.body

    const db = require('../../../lib/@system/PostgreSQL')
    const row = await db.oneOrNone(
      `SELECT id, user_id, used_at, expires_at
       FROM password_reset_tokens
       WHERE token = $1`,
      [token],
    )

    if (!row) return res.status(400).json({ message: 'Invalid or expired reset link' })
    if (row.used_at) return res.status(400).json({ message: 'This reset link has already been used' })
    if (new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ message: 'This reset link has expired. Please request a new one.' })
    }

    const password_hash = await bcrypt.hash(password, 12)
    await db.tx(async (t) => {
      await t.none('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [
        password_hash,
        row.user_id,
      ])
      await t.none('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [row.id])
    })

    res.json({ message: 'Password updated successfully' })
  } catch (err) {
    if (isDbConnectionError(err)) {
      return res.status(503).json({ message: 'Service temporarily unavailable. Please try again later.' })
    }
    next(err)
  }
})

module.exports = router
