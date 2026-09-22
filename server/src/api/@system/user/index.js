// @system — user management API
// POST /api/users                         — register (sends verification email)
// POST /api/users/provision               — [admin] provision password-less account & email a first-login set-password link
// GET  /api/users/me                      — get current user
// PATCH /api/users/me                     — update profile
// POST /api/users/me/password             — change password (requires current)
// GET  /api/users/me/notifications        — get email notification preferences
// PATCH /api/users/me/notifications       — update email notification preferences
// POST /api/users/password/request        — request a password reset email
// POST /api/users/password/reset          — complete password reset with token
// POST /api/users/password/set            — choose a password with a first-login (provisioning) token
// POST /api/users/email/verify/request    — resend email verification link
// POST /api/users/email/verify            — verify email with token
const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const { authenticate, requireAdmin } = require('../../../lib/@system/Helpers/auth')
const { validatePassword } = require('../../../lib/@system/Helpers/password-validator')
const UserRepo = require('../../../db/repos/@system/UserRepo')
const SessionRepo = require('../../../db/repos/@system/SessionRepo')
const db = require('../../../lib/@system/PostgreSQL')
const logger = require('../../../lib/@system/Logger')
const { registerLimiter, passwordResetLimiter } = require('../../../lib/@system/RateLimit')
const emailService = require('../../../lib/@system/Email')
const { validate } = require('../../../lib/@system/Validation')
const { requireModule, SELF_REGISTRATION_DISABLED_MESSAGE } = require('../../../lib/@system/Helpers/modules')
const {
  RegisterBody,
  UpdateProfileBody,
  ChangePasswordBody,
  PasswordResetRequestBody,
  PasswordResetBody,
  ProvisionUserBody,
  SetPasswordBody,
  VerifyEmailBody,
  NotificationPrefsBody,
} = require('../../../lib/@system/Validation/schemas/@system/user')

// ── Helpers ───────────────────────────────────────────────────────────────

/** Create a fresh email verification token for a user and return the raw token. */
async function createEmailVerificationToken(userId) {
  // Invalidate any pending tokens for this user first
  await db.none(
    'UPDATE email_verification_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL',
    [userId]
  )
  const token = crypto.randomBytes(32).toString('hex')
  await db.none(
    'INSERT INTO email_verification_tokens (user_id, token) VALUES ($1, $2)',
    [userId, token]
  )
  return token
}

// ── Register ──────────────────────────────────────────────────────────────

// POST /api/users — register
// Third public registration path (with /api/auth/register and /api/sessions/register);
// all three answer 403 when brand.json modules.selfRegistration is false.
// POST /api/users/provision (admin) is unaffected.
router.post('/users', requireModule('selfRegistration', SELF_REGISTRATION_DISABLED_MESSAGE))
router.post('/users', registerLimiter, validate({ body: RegisterBody }), async (req, res, next) => {
  try {
    const { email, password, name } = req.body
    const pwCheck = validatePassword(password)
    if (!pwCheck.valid) return res.status(400).json({ message: pwCheck.message })

    const existing = await UserRepo.findByEmail(email)
    if (existing) return res.status(409).json({ message: 'Email already in use' })

    const password_hash = await bcrypt.hash(password, 12)
    const user = await UserRepo.create({ email, name, password_hash })

    // Send verification email asynchronously — don't block registration response
    setImmediate(async () => {
      try {
        const token = await createEmailVerificationToken(user.id)
        await emailService.sendVerificationEmail({ to: user.email, name: user.name, token })
        logger.info({ userId: user.id }, 'verification email sent on registration')
      } catch (err) {
        logger.error({ err, userId: user.id }, 'failed to send verification email on registration')
      }
    })

    res.status(201).json({ user: { id: user.id, email: user.email, name: user.name } })
  } catch (err) {
    next(err)
  }
})

// ── Profile ───────────────────────────────────────────────────────────────

// GET /api/users/me — get current user
router.get('/users/me', authenticate, (req, res) => {
  res.json({ user: req.user })
})

// PATCH /api/users/me — update profile (name only; email requires verification)
router.patch('/users/me', authenticate, validate({ body: UpdateProfileBody }), async (req, res, next) => {
  try {
    const { name } = req.body
    const updated = await UserRepo.update(req.user.id, { name: name?.trim() })
    res.json({ user: updated })
  } catch (err) {
    next(err)
  }
})

// POST /api/users/me/password — change password (must supply current password)
router.post('/users/me/password', authenticate, validate({ body: ChangePasswordBody }), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body
    const pwCheck = validatePassword(newPassword)
    if (!pwCheck.valid) return res.status(400).json({ message: pwCheck.message })

    const user = await db.oneOrNone('SELECT * FROM users WHERE id = $1', [req.user.id])
    const valid = await bcrypt.compare(currentPassword, user.password_hash)
    if (!valid) return res.status(401).json({ message: 'Current password is incorrect' })

    const password_hash = await bcrypt.hash(newPassword, 12)
    await db.none('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [req.user.id, password_hash])

    // Invalidate all sessions — credential changed, no prior session is trustworthy
    await SessionRepo.revokeAllByUserId(req.user.id)

    res.json({ message: 'Password updated' })
  } catch (err) {
    next(err)
  }
})

// ── Email Verification ────────────────────────────────────────────────────

// POST /api/users/email/verify/request — resend a verification email
router.post('/users/email/verify/request', authenticate, async (req, res, next) => {
  try {
    // Already verified?
    if (req.user.emailVerified) {
      return res.status(400).json({ message: 'Email is already verified' })
    }

    const token = await createEmailVerificationToken(req.user.id)
    await emailService.sendVerificationEmail({ to: req.user.email, name: req.user.name, token })
    logger.info({ userId: req.user.id }, 'verification email resent on request')

    res.json({ message: 'Verification email sent. Please check your inbox.' })
  } catch (err) {
    next(err)
  }
})

// POST /api/users/email/verify — verify email using the token from the email link
router.post('/users/email/verify', validate({ body: VerifyEmailBody }), async (req, res, next) => {
  try {
    const { token } = req.body

    const record = await db.oneOrNone(
      `SELECT * FROM email_verification_tokens
       WHERE token = $1
         AND used_at IS NULL
         AND expires_at > now()`,
      [token]
    )
    if (!record) return res.status(400).json({ message: 'Invalid or expired verification token' })

    // Mark email as verified + invalidate the token
    const [user] = await Promise.all([
      UserRepo.verifyEmail(record.user_id),
      db.none('UPDATE email_verification_tokens SET used_at = now() WHERE id = $1', [record.id]),
    ])

    logger.info({ userId: record.user_id }, 'email verified')
    res.json({ message: 'Email verified successfully.', user: { id: user.id, email: user.email, emailVerified: true } })

    // Send welcome email asynchronously — don't block the verify response
    setImmediate(async () => {
      try {
        await emailService.sendWelcomeEmail({ to: user.email, name: user.name, userId: user.id })
        logger.info({ userId: user.id }, 'welcome email sent after verification')
      } catch (err) {
        logger.error({ err, userId: user.id }, 'failed to send welcome email after verification')
      }
    })
  } catch (err) {
    next(err)
  }
})

// ── Account Provisioning (first login) ────────────────────────────────────

// Mint a fresh first-login set-password token. Unlike forgot-password resets this
// uses a 7-day window since the recipient hasn't signed in yet.
async function mintSetPasswordToken(userId) {
  await db.none(
    'UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL',
    [userId]
  )
  const token = crypto.randomBytes(32).toString('hex')
  await db.none(
    "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, now() + INTERVAL '7 days')",
    [userId, token]
  )
  return token
}

// POST /api/users/provision — [admin] create a password-less account and email the
// user a one-time "set your password" link so they can activate it on first login.
router.post('/users/provision', requireAdmin, passwordResetLimiter, validate({ body: ProvisionUserBody }), async (req, res, next) => {
  try {
    const { email, name } = req.body

    const existing = await UserRepo.findByEmail(email)
    let user

    if (existing) {
      if (existing.password_hash) {
        return res.status(409).json({ message: 'This user already has a password and can sign in normally.' })
      }
      // Password-less (e.g. previously OAuth-only) account — reuse it and refresh its name if supplied.
      if (name?.trim() && existing.name !== name.trim()) {
        user = await UserRepo.update(existing.id, { name: name.trim() })
      } else {
        user = existing
      }
    } else {
      user = await UserRepo.create({ email, name: name?.trim() ?? email.split('@')[0], password_hash: null, role: 'user' })
    }

    logger.info({ actorId: req.user.id, userId: user.id }, 'admin provisioned account — set-password flow started')

    // Respond immediately, then send the first-login email asynchronously.
    res.status(201).json({
      message: 'Set-password email sent. Ask the user to click the link and choose a password.',
      user: { id: user.id, email: user.email, name: user.name },
    })

    setImmediate(async () => {
      try {
        const token = await mintSetPasswordToken(user.id)
        await emailService.sendSetPasswordEmail({ to: user.email, name: user.name, token, userId: user.id })
        logger.info({ userId: user.id }, 'set-password email sent after provisioning')
      } catch (err) {
        logger.error({ err, userId: user.id }, 'failed to send set-password email after provisioning')
      }
    })
  } catch (err) {
    next(err)
  }
})

// ── Password Reset ────────────────────────────────────────────────────────

// POST /api/users/password/request — generate a reset token and (conceptually) send an email
router.post('/users/password/request', passwordResetLimiter, validate({ body: PasswordResetRequestBody }), async (req, res, next) => {
  try {
    const { email } = req.body

    // Always respond 200 to avoid user enumeration
    res.json({ message: 'If this email exists, a reset link has been sent.' })

    const user = await UserRepo.findByEmail(email)
    if (!user) return // silent — response already sent

    // Invalidate any existing tokens for this user
    await db.none(
      'UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL',
      [user.id]
    )

    const token = crypto.randomBytes(32).toString('hex')
    await db.none(
      'INSERT INTO password_reset_tokens (user_id, token) VALUES ($1, $2)',
      [user.id, token]
    )

    logger.info({ userId: user.id }, 'password reset token generated')

    await emailService.sendPasswordResetEmail({ to: user.email, name: user.name, token, userId: user.id })
  } catch (err) {
    logger.error({ err }, 'password reset request failed silently')
  }
})

// POST /api/users/password/reset — complete reset using token
router.post('/users/password/reset', passwordResetLimiter, validate({ body: PasswordResetBody }), async (req, res, next) => {
  try {
    const { token, password } = req.body
    const pwCheck = validatePassword(password)
    if (!pwCheck.valid) return res.status(400).json({ message: pwCheck.message })

    const record = await db.oneOrNone(
      `SELECT * FROM password_reset_tokens
       WHERE token = $1
         AND used_at IS NULL
         AND expires_at > now()`,
      [token]
    )
    if (!record) return res.status(400).json({ message: 'Invalid or expired reset token' })

    const password_hash = await bcrypt.hash(password, 12)
    await Promise.all([
      db.none('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [record.user_id, password_hash]),
      db.none('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [record.id]),
    ])

    // Invalidate all sessions — credential changed, no prior session is trustworthy
    await SessionRepo.revokeAllByUserId(record.user_id)

    res.json({ message: 'Password reset successfully. You can now log in.' })
  } catch (err) {
    next(err)
  }
})

// POST /api/users/password/set — choose a password using a first-login (provisioning)
// token. Same token table as resets, but semantically "select your initial password".
router.post('/users/password/set', passwordResetLimiter, validate({ body: SetPasswordBody }), async (req, res, next) => {
  try {
    const { token, password } = req.body
    const pwCheck = validatePassword(password)
    if (!pwCheck.valid) return res.status(400).json({ message: pwCheck.message })

    const record = await db.oneOrNone(
      `SELECT * FROM password_reset_tokens
       WHERE token = $1
         AND used_at IS NULL
         AND expires_at > now()`,
      [token]
    )
    if (!record) return res.status(400).json({ message: 'Invalid or expired set-password link. Ask an admin to resend it.' })

    const password_hash = await bcrypt.hash(password, 12)
    await Promise.all([
      db.none('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [record.user_id, password_hash]),
      db.none('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [record.id]),
    ])

    // Invalidate prior sessions — credential now set, token is single-use.
    await SessionRepo.revokeAllByUserId(record.user_id)

    res.json({ message: 'Password set successfully. You can now sign in.' })
  } catch (err) {
    next(err)
  }
})

// ── Email Notification Preferences ───────────────────────────────────────────

const NOTIFICATION_KEYS = ['security', 'billing', 'activity', 'marketing', 'inApp', 'weeklyDigest', 'mentions']
const DEFAULT_NOTIFICATIONS = { security: true, billing: true, activity: false, marketing: false, inApp: true, weeklyDigest: false, mentions: true }

// GET /api/users/me/notifications — get current notification preferences
router.get('/users/me/notifications', authenticate, async (req, res, next) => {
  try {
    const row = await db.oneOrNone(
      'SELECT email_notifications FROM users WHERE id = $1',
      [req.user.id]
    )
    const prefs = row?.email_notifications ?? DEFAULT_NOTIFICATIONS
    res.json({ notifications: prefs })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/users/me/notifications — update notification preferences
router.patch('/users/me/notifications', authenticate, validate({ body: NotificationPrefsBody }), async (req, res, next) => {
  try {
    const incoming = req.body ?? {}

    // Only allow known keys; merge with existing prefs
    const row = await db.oneOrNone(
      'SELECT email_notifications FROM users WHERE id = $1',
      [req.user.id]
    )
    const current = row?.email_notifications ?? DEFAULT_NOTIFICATIONS
    const updated = { ...current }

    for (const key of NOTIFICATION_KEYS) {
      if (typeof incoming[key] === 'boolean') {
        updated[key] = incoming[key]
      }
    }

    await db.none(
      'UPDATE users SET email_notifications = $2, updated_at = now() WHERE id = $1',
      [req.user.id, JSON.stringify(updated)]
    )

    res.json({ notifications: updated })
  } catch (err) {
    next(err)
  }
})

module.exports = router
