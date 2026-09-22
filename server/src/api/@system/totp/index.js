// @system — TOTP / 2FA management API
//
// POST /api/users/me/2fa/setup    — generate a new TOTP secret + QR code URI
// POST /api/users/me/2fa/enable   — verify a TOTP code and activate 2FA
// POST /api/users/me/2fa/disable  — deactivate 2FA (requires current TOTP code or password)
// GET  /api/users/me/2fa/status   — return { enabled: boolean }

const express = require('express')
const router = express.Router()
const { authenticate } = require('../../../lib/@system/Helpers/auth')
const db = require('../../../lib/@system/PostgreSQL')
const logger = require('../../../lib/@system/Logger')
const OTPAuth = require('otpauth')
const QRCode = require('qrcode')
const bcrypt = require('bcryptjs')
const { validate } = require('../../../lib/@system/Validation')
const { EnableTotpBody, DisableTotpBody } = require('../../../lib/@system/Validation/schemas/@system/totp')
const { totpSetupLimiter, totpEnableLimiter } = require('../../../lib/@system/RateLimit')
const { verifyTotpCode, TOTP_PARAMS } = require('../../../lib/@system/Helpers/totp')

const APP_NAME = process.env.APP_NAME ?? 'App'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTOTP(secret, email) {
  return new OTPAuth.TOTP({
    issuer: APP_NAME,
    label: email,
    ...TOTP_PARAMS,
    secret: OTPAuth.Secret.fromBase32(secret),
  })
}

function generateSecret() {
  return new OTPAuth.Secret({ size: 20 }).base32
}

// Verification is shared with the login gate (Helpers/loginFlow) so enrolment and login agree.
const verifyCode = verifyTotpCode

// ─── GET /api/users/me/2fa/status ────────────────────────────────────────────

router.get('/users/me/2fa/status', authenticate, async (req, res, next) => {
  try {
    const user = await db.oneOrNone(
      'SELECT totp_enabled FROM users WHERE id = $1',
      [req.user.id],
    )
    res.json({ enabled: user?.totp_enabled ?? false })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/users/me/2fa/setup ────────────────────────────────────────────

router.post('/users/me/2fa/setup', authenticate, totpSetupLimiter, async (req, res, next) => {
  try {
    const user = await db.oneOrNone('SELECT * FROM users WHERE id = $1', [req.user.id])
    if (user.totp_enabled) {
      return res.status(409).json({ message: '2FA is already enabled. Disable it first.' })
    }

    const secret = generateSecret()

    // Upsert pending secret (replace any previous attempt)
    await db.none(
      `INSERT INTO totp_pending_secrets (user_id, secret)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE
         SET secret = EXCLUDED.secret,
             created_at = now(),
             expires_at = now() + INTERVAL '10 minutes'`,
      [user.id, secret],
    )

    const totp = makeTOTP(secret, user.email)
    const otpauthUri = totp.toString()
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri)

    logger.info({ userId: user.id }, '2FA setup initiated')

    res.json({
      secret,
      otpauthUri,
      qrCodeDataUrl,
      message: 'Scan the QR code with your authenticator app, then call /enable with a valid code.',
    })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/users/me/2fa/enable ───────────────────────────────────────────

router.post('/users/me/2fa/enable', authenticate, totpEnableLimiter, validate({ body: EnableTotpBody }), async (req, res, next) => {
  try {
    const { code } = req.body

    const pending = await db.oneOrNone(
      `SELECT * FROM totp_pending_secrets
       WHERE user_id = $1 AND expires_at > now()`,
      [req.user.id],
    )
    if (!pending) {
      return res.status(400).json({ message: 'No pending 2FA setup found. Call /setup first.' })
    }

    if (!verifyCode(pending.secret, code)) {
      return res.status(400).json({ message: 'Invalid or expired TOTP code' })
    }

    await db.tx(async (t) => {
      await t.none(
        'UPDATE users SET totp_secret = $2, totp_enabled = TRUE, updated_at = now() WHERE id = $1',
        [req.user.id, pending.secret],
      )
      await t.none('DELETE FROM totp_pending_secrets WHERE user_id = $1', [req.user.id])
    })

    logger.info({ userId: req.user.id }, '2FA enabled successfully')
    res.json({ message: '2FA enabled successfully.' })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/users/me/2fa/disable ──────────────────────────────────────────

router.post('/users/me/2fa/disable', authenticate, totpEnableLimiter, validate({ body: DisableTotpBody }), async (req, res, next) => {
  try {
    const { code, password } = req.body

    const user = await db.oneOrNone('SELECT * FROM users WHERE id = $1', [req.user.id])
    if (!user?.totp_enabled) {
      return res.status(400).json({ message: '2FA is not enabled.' })
    }

    // Allow either a valid TOTP code OR the current password to disable
    let verified = false

    if (code) {
      verified = verifyCode(user.totp_secret, code)
    } else if (password) {
      verified = await bcrypt.compare(password, user.password_hash)
    }

    if (!verified) {
      return res.status(401).json({ message: 'Verification failed. Provide a valid TOTP code or your current password.' })
    }

    await db.none(
      'UPDATE users SET totp_secret = NULL, totp_enabled = FALSE, updated_at = now() WHERE id = $1',
      [req.user.id],
    )

    logger.info({ userId: req.user.id }, '2FA disabled')
    res.json({ message: '2FA disabled.' })
  } catch (err) {
    next(err)
  }
})

module.exports = router
