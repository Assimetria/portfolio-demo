// @system — Login completion shared by every password login route (POST /api/auth/login,
// POST /api/sessions). Once the password has been verified, this is the ONLY code path that may
// turn a user row into tokens, so the second factor cannot be skipped by picking a different route.
//
// Contract (matches the historical /api/sessions behaviour the client already implements):
//   user.totp_enabled && no totpCode      → 200 { totp_required: true }   (client prompts for the code)
//   user.totp_enabled && wrong totpCode   → 401 { message }               (counted as a failed attempt)
//   otherwise                             → cookies access_token + refresh_token, 200 { user }
'use strict'

const crypto = require('crypto')
const RefreshTokenRepo = require('../../../db/repos/@system/RefreshTokenRepo')
const SessionRepo = require('../../../db/repos/@system/SessionRepo')
const { signAccessTokenAsync } = require('./jwt')
const { setAccessCookie, setRefreshCookie } = require('./cookies')
const { toPublicUser } = require('./auth')
const { verifyTotpCode } = require('./totp')
const { incrementFailedAttempts } = require('../AccountLockout')

const TOTP_REQUIRED_BODY = Object.freeze({ totp_required: true })
const TOTP_INVALID_MESSAGE = 'Invalid or expired authenticator code.'

/** SHA-256 hash of a raw token — sessions store only the hash. */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Apply the second-factor gate and, if it passes, issue the session. Writes the response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {object} user             full users row (needs id, email, totp_enabled, totp_secret)
 * @param {{ totpCode?: string|number, rememberMe?: boolean }} opts
 */
async function completeLogin(req, res, user, { totpCode, rememberMe = false } = {}) {
  if (user.totp_enabled) {
    if (totpCode === undefined || totpCode === null || totpCode === '') {
      return res.status(200).json(TOTP_REQUIRED_BODY)
    }
    if (!verifyTotpCode(user.totp_secret, totpCode)) {
      await incrementFailedAttempts(String(user.email).toLowerCase())
      return res.status(401).json({ message: TOTP_INVALID_MESSAGE })
    }
  }

  // Short-lived access token + opaque refresh token (starts a new family).
  const accessToken = await signAccessTokenAsync({ userId: user.id })
  const { token: refreshToken, record: refreshRecord } = await RefreshTokenRepo.create({ userId: user.id })

  // Session row for the "Active Sessions" list + per-device revocation. Fire-and-forget so a
  // failed insert never blocks a valid login.
  await SessionRepo.create({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    ipAddress: req.ip ?? req.headers['x-forwarded-for'] ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    expiresAt: refreshRecord.expires_at,
  }).catch(() => {})

  setAccessCookie(res, accessToken)
  setRefreshCookie(res, refreshToken, { rememberMe: !!rememberMe })

  // Same public shape as GET /sessions/me — the client routes on user.role right after login.
  return res.json({ user: toPublicUser(user) })
}

module.exports = { completeLogin, hashToken, TOTP_REQUIRED_BODY, TOTP_INVALID_MESSAGE }
