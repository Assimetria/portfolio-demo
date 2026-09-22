// @system — SMTP email adapter
// Sends email via any SMTP server using nodemailer.
// Works with Resend SMTP relay, SendGrid, Mailgun, Postmark, self-hosted, etc.
//
// Required env vars:
//   SMTP_HOST  — SMTP hostname (e.g. smtp.resend.com, smtp.sendgrid.net)
//   SMTP_PORT  — Port number (default: 587)
//   SMTP_USER  — SMTP username
//   SMTP_PASS  — SMTP password / API key
//   EMAIL_FROM — Sender address e.g. "App <noreply@yourdomain.com>"
//
// Optional:
//   SMTP_SECURE         — 'true' to force TLS (auto-detected: true if port 465)
//   SMTP_IGNORE_TLS     — 'true' to disable STARTTLS (useful for local mailtrap/mailhog)
//   SMTP_TIMEOUT_MS     — Connection timeout in ms (default: 10000)
//   SMTP_POOL           — 'true' to use connection pooling (recommended for high volume)
//   SMTP_MAX_CONNECTIONS— Pool size when SMTP_POOL=true (default: 5)
//
// Resend SMTP quick-start:
//   SMTP_HOST=smtp.resend.com
//   SMTP_PORT=587
//   SMTP_USER=resend
//   SMTP_PASS=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//   EMAIL_FROM=App <noreply@yourdomain.com>
//
// Usage (via Email index — do not call directly):
//   const adapter = require('./adapters/smtp')
//   const transporter = adapter.createTransport()
//   await adapter.send({ transporter, from, to, subject, html, text })

'use strict'

const logger = require('../../Logger')

/**
 * Build a nodemailer transport from env vars.
 * Returns a configured nodemailer transporter.
 * Throws if SMTP_HOST is missing.
 */
function createTransport() {
  const nodemailer = require('nodemailer')

  if (!process.env.SMTP_HOST) {
    throw new Error('[Email/SMTP] SMTP_HOST env var is required')
  }

  const port = Number(process.env.SMTP_PORT ?? 587)
  const secureEnv = process.env.SMTP_SECURE?.toLowerCase()
  const secure = secureEnv === 'true' ? true : secureEnv === 'false' ? false : port === 465
  const ignoreTLS = process.env.SMTP_IGNORE_TLS === 'true'
  const connectionTimeout = Number(process.env.SMTP_TIMEOUT_MS ?? 10000)
  const pool = process.env.SMTP_POOL === 'true'
  const maxConnections = Number(process.env.SMTP_MAX_CONNECTIONS ?? 5)

  const auth =
    process.env.SMTP_USER && process.env.SMTP_PASS
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined

  const config = {
    host: process.env.SMTP_HOST,
    port,
    secure,
    ...(ignoreTLS && { ignoreTLS: true }),
    ...(auth && { auth }),
    connectionTimeout,
    ...(pool && { pool: true, maxConnections }),
    tls: {
      // Allow self-signed certs in dev/test — never disable in production
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  }

  const transporter = nodemailer.createTransport(config)

  logger.info(
    { host: process.env.SMTP_HOST, port, secure, pool },
    '[Email/SMTP] transport created',
  )

  return transporter
}

/**
 * Send an email via an existing nodemailer transporter.
 *
 * @param {object}  opts
 * @param {object}  opts.transporter  nodemailer transporter instance
 * @param {string}  opts.from         Sender
 * @param {string}  opts.to           Recipient
 * @param {string}  opts.subject      Subject line
 * @param {string}  opts.html         HTML body
 * @param {string} [opts.text]        Plain-text fallback
 * @param {string} [opts.replyTo]     Reply-to address
 * @param {string[]} [opts.cc]        CC recipients
 * @param {string[]} [opts.bcc]       BCC recipients
 * @param {object[]} [opts.attachments] nodemailer attachments array
 * @returns {Promise<{ messageId: string, provider: 'smtp' }>}
 */
async function send({ transporter, from, to, subject, html, text, replyTo, cc, bcc, attachments }) {
  const mailOptions = {
    from,
    to,
    subject,
    html,
    ...(text && { text }),
    ...(replyTo && { replyTo }),
    ...(cc?.length && { cc }),
    ...(bcc?.length && { bcc }),
    ...(attachments?.length && { attachments }),
  }

  let info
  try {
    info = await transporter.sendMail(mailOptions)
  } catch (err) {
    logger.error({ err, to, subject }, '[Email/SMTP] sendMail failed')
    throw err
  }

  const messageId = info.messageId ?? 'unknown'
  logger.info({ messageId, to, subject }, '[Email/SMTP] sent')

  return { messageId, provider: 'smtp' }
}

/**
 * Verify SMTP connectivity by calling transporter.verify().
 * Returns { valid: true } on success, { valid: false, reason } on failure.
 * Does NOT throw — safe to call in health checks.
 *
 * @param {object} transporter  nodemailer transporter instance
 */
async function verify(transporter) {
  try {
    await transporter.verify()
    return { valid: true }
  } catch (err) {
    return { valid: false, reason: err.message }
  }
}

module.exports = { createTransport, send, verify }
