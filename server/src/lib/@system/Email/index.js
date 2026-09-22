// @system — Email service
// Sends transactional emails via three possible transports (in priority order):
//   1. Resend  — when EMAIL_PROVIDER=resend or RESEND_API_KEY is set (and SMTP_HOST is absent)
//   2. SMTP    — when SMTP_HOST is configured (also covers Resend SMTP relay)
//   3. SES     — when EMAIL_PROVIDER=ses or AWS creds are set
//   4. Console — dev fallback when nothing is configured
//
// Environment variables:
//   EMAIL_PROVIDER         — 'resend' | 'smtp' | 'ses' | 'console' (optional; auto-detected)
//   EMAIL_FROM             — Sender e.g. "App <noreply@example.com>"
//   APP_URL                — Used to build action links in templates
//   APP_NAME               — Product display name used in email copy (default: 'App')
//   EMAIL_TRACKING_SECRET  — Shared secret for /api/email-logs ingestion
//
//   Resend (native API):
//     RESEND_API_KEY       — Resend API key (re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)
//     RESEND_REPLY_TO      — Optional reply-to address
//
//   SMTP (any provider including Resend SMTP relay):
//     SMTP_HOST            — SMTP hostname e.g. smtp.resend.com, smtp.sendgrid.net
//     SMTP_PORT            — Port (default: 587)
//     SMTP_USER            — Username
//     SMTP_PASS            — Password / API key
//     SMTP_SECURE          — 'true' to force TLS (auto: true if port 465)
//     SMTP_POOL            — 'true' to use connection pooling
//
//   SES:
//     AWS_REGION           — e.g. eu-west-1
//     AWS_ACCESS_KEY_ID    — IAM access key
//     AWS_SECRET_ACCESS_KEY— IAM secret key
//     SES_FROM_EMAIL       — Fallback sender when EMAIL_FROM is absent
//
// Usage:
//   const Email = require('./lib/@system/Email')
//   await Email.sendVerificationEmail({ to, name, token })
//   await Email.sendPasswordResetEmail({ to, name, token })
//   await Email.sendWelcomeEmail({ to, name })
//   await Email.sendInvitationEmail({ to, inviterName, orgName, token })
//   await Email.sendMagicLinkEmail({ to, name, token })
//   await Email.sendNotificationEmail({ to, subject, title, body, ctaLabel, ctaUrl })
//   await Email.send({ to, subject, html, text, template })  // raw send

'use strict'

const logger = require('../Logger')
const templates = require('./templates')

// ── Transport / adapter state ─────────────────────────────────────────────────

let _state = null  // { provider, smtpTransporter? }
let _onEmailSent = null  // optional callback: (emailData) => Promise<void>

/**
 * Detect the active provider and initialise adapters once.
 * Returns { provider } where provider is 'resend' | 'smtp' | 'ses' | 'console'.
 */
function getTransport() {
  if (_state !== null) return _state

  const explicit = (process.env.EMAIL_PROVIDER ?? '').toLowerCase()

  // ── Resend (native API) ───────────────────────────────────────────────────
  const hasResendKey = !!process.env.RESEND_API_KEY
  const preferResend =
    explicit === 'resend' ||
    (!explicit && !process.env.SMTP_HOST && !process.env.AWS_ACCESS_KEY_ID && hasResendKey)

  if (preferResend) {
    if (!hasResendKey) {
      logger.warn('[Email] EMAIL_PROVIDER=resend but RESEND_API_KEY is not set — falling back')
    } else {
      _state = { provider: 'resend' }
      logger.info('[Email] Resend adapter initialised (native API)')
      return _state
    }
  }

  // ── SES ───────────────────────────────────────────────────────────────────
  const hasSesCredentials =
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    (process.env.SES_FROM_EMAIL || process.env.EMAIL_FROM)

  if (explicit === 'ses' || (!explicit && !process.env.SMTP_HOST && hasSesCredentials)) {
    try {
      const nodemailer = require('nodemailer')
      const { SESClient, SendRawEmailCommand } = require('@aws-sdk/client-ses')

      const ses = new SESClient({
        region: process.env.AWS_REGION ?? 'eu-west-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      })

      const transporter = nodemailer.createTransport({
        SES: { ses, aws: { SendRawEmailCommand } },
        sendingRate: 14,
      })

      _state = { provider: 'ses', smtpTransporter: transporter }
      logger.info({ region: process.env.AWS_REGION }, '[Email] SES transport initialised')
      return _state
    } catch (err) {
      logger.warn({ err }, '[Email] SES init failed — falling back to SMTP')
    }
  }

  // ── SMTP (covers Resend SMTP relay, SendGrid, Mailgun, etc.) ─────────────
  if (explicit === 'smtp' || process.env.SMTP_HOST) {
    try {
      const smtpAdapter = require('./adapters/smtp')
      const transporter = smtpAdapter.createTransport()
      _state = { provider: 'smtp', smtpTransporter: transporter }
      return _state
    } catch (err) {
      logger.warn({ err }, '[Email] SMTP init failed — falling back to console')
    }
  }

  // ── Console (dev fallback) ────────────────────────────────────────────────
  _state = { provider: 'console' }
  logger.warn(
    '[Email] No transport configured — emails logged to console only. ' +
      'Set RESEND_API_KEY, SMTP_HOST, or EMAIL_PROVIDER=ses to enable real sending.',
  )
  return _state
}

// ── Core send ─────────────────────────────────────────────────────────────────

/**
 * Send an email.
 *
 * @param {object}  opts
 * @param {string}  opts.to        Recipient address
 * @param {string}  opts.subject   Subject line
 * @param {string}  opts.html      HTML body
 * @param {string} [opts.text]     Plain-text fallback (auto-stripped from html if omitted)
 * @param {string} [opts.template] Template identifier for logging (e.g. 'verification')
 * @param {number} [opts.userId]   Associated user ID for log record
 * @param {string} [opts.replyTo]  Reply-to address
 * @param {string[]} [opts.cc]     CC recipients
 * @param {string[]} [opts.bcc]    BCC recipients
 * @param {object[]} [opts.attachments] Attachments
 * @returns {Promise<{ messageId: string, provider: string, devMode?: boolean }>}
 */
async function send({ to, subject, html, text, template, userId, replyTo, cc, bcc, attachments }) {
  const from =
    process.env.EMAIL_FROM ??
    process.env.SES_FROM_EMAIL ??
    'noreply@example.com'

  const plainText = text ?? _htmlToText(html)
  const { provider, smtpTransporter } = getTransport()

  // ── Console ──────────────────────────────────────────────────────────────
  if (provider === 'console') {
    logger.info(
      { to, subject, html },
      '[Email] Console mode — email NOT sent. Set RESEND_API_KEY, SMTP_HOST, or EMAIL_PROVIDER=ses.',
    )
    const urlMatch = html.match(/href="([^"]+)"/)
    if (urlMatch) logger.info({ url: urlMatch[1] }, '[Email] Action URL')

    await _trackEmail({ to, subject, template, messageId: 'console', provider: 'console', userId })
    return { messageId: 'console', provider: 'console', devMode: true }
  }

  let messageId
  let sendError = null

  try {
    let result

    if (provider === 'resend') {
      const resendAdapter = require('./adapters/resend')
      result = await resendAdapter.send({ from, to, subject, html, text: plainText, replyTo, cc, bcc, attachments })
    } else if (provider === 'smtp' || provider === 'ses') {
      // Both ses and smtp use the nodemailer transporter stored in state
      const info = await smtpTransporter.sendMail({
        from,
        to,
        subject,
        html,
        text: plainText,
        ...(replyTo && { replyTo }),
        ...(cc?.length && { cc }),
        ...(bcc?.length && { bcc }),
        ...(attachments?.length && { attachments }),
      })
      result = { messageId: info.messageId, provider }
    }

    messageId = result.messageId
    logger.info({ to, subject, messageId, provider }, '[Email] sent')
  } catch (err) {
    sendError = err
    logger.error({ err, to, subject }, '[Email] send failed')
  }

  await _trackEmail({
    to,
    subject,
    template,
    messageId: messageId ?? null,
    provider,
    status: sendError ? 'failed' : 'sent',
    error: sendError ? String(sendError.message) : null,
    userId,
  })

  if (sendError) throw sendError

  return { messageId, provider }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Fire-and-forget: persist an email log record via optional callback.
 * Fails silently so email delivery is never blocked by a logging error.
 */
async function _trackEmail({ to, subject, template, messageId, provider, status = 'sent', error = null, userId }) {
  if (!_onEmailSent) return  // No tracking callback registered
  
  try {
    await _onEmailSent({
      to_address: to,
      subject,
      template: template ?? null,
      status,
      message_id: messageId ?? null,
      provider: provider ?? null,
      error: error ?? null,
      user_id: userId ?? null,
    })
  } catch (_callbackErr) {
    // Silently ignore — logging must never break email delivery
  }
}

/**
 * Register a callback to track sent emails.
 * @param {Function} callback - (emailData) => Promise<void>
 */
function setEmailSentCallback(callback) {
  _onEmailSent = callback
}

/**
 * Very lightweight HTML → plain-text fallback.
 */
function _htmlToText(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// ── Template senders ──────────────────────────────────────────────────────────

/** Send an email-verification link. */
async function sendVerificationEmail({ to, name, token, userId }) {
  const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
  const verifyUrl = `${appUrl}/verify-email?token=${token}`
  return send({
    to,
    subject: 'Verify your email address',
    html: templates.verification({ name, verifyUrl }),
    text: `Verify your email: ${verifyUrl}`,
    template: 'verification',
    userId,
  })
}

/** Send a password-reset link. */
async function sendPasswordResetEmail({ to, name, token, userId }) {
  const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
  const resetUrl = `${appUrl}/reset-password?token=${token}`
  return send({
    to,
    subject: 'Reset your password',
    html: templates.passwordReset({ name, resetUrl }),
    text: `Reset your password: ${resetUrl}`,
    template: 'password_reset',
    userId,
  })
}

/**
 * Send a first-login set-password link (admin-provisioned account).
 * Unlike forgot-password resets, the token is minted with a 7-day window and the
 * link points at the standalone /set-password page.
 */
async function sendSetPasswordEmail({ to, name, token, userId }) {
  const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
  const setPasswordUrl = `${appUrl}/set-password?token=${token}`
  return send({
    to,
    subject: 'Set your password to activate your account',
    html: templates.setPassword({ name, setPasswordUrl }),
    text: `Set your password to activate your account: ${setPasswordUrl}`,
    template: 'set_password',
    userId,
  })
}

/** Send a welcome email after successful registration. */
async function sendWelcomeEmail({ to, name, userId }) {
  const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
  const appName = process.env.APP_NAME ?? 'App'
  return send({
    to,
    subject: `Welcome to ${appName}`,
    html: templates.welcome({ name, appUrl, appName }),
    text: `Welcome to ${appName}! Visit ${appUrl} to get started.`,
    template: 'welcome',
    userId,
  })
}

/** Send a team / workspace invitation. */
async function sendInvitationEmail({ to, inviterName, orgName, token, userId }) {
  const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
  const inviteUrl = `${appUrl}/accept-invite?token=${token}`
  return send({
    to,
    subject: `${inviterName} invited you to ${orgName}`,
    html: templates.invitation({ inviterName, orgName, inviteUrl }),
    text: `${inviterName} invited you to join ${orgName}. Accept here: ${inviteUrl}`,
    template: 'invitation',
    userId,
  })
}

/** Send a magic-link (passwordless) login email. */
async function sendMagicLinkEmail({ to, name, token, userId }) {
  const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
  const magicUrl = `${appUrl}/magic-link?token=${token}`
  return send({
    to,
    subject: 'Your sign-in link',
    html: templates.magicLink({ name, magicUrl }),
    text: `Sign in here (link expires in 15 minutes): ${magicUrl}`,
    template: 'magic_link',
    userId,
  })
}

/** Send a generic notification email with an optional CTA button. */
async function sendNotificationEmail({ to, subject, title, body, ctaLabel, ctaUrl, userId }) {
  return send({
    to,
    subject,
    html: templates.notification({ title, body, ctaLabel, ctaUrl }),
    text: ctaUrl ? `${title}\n\n${body}\n\n${ctaLabel ?? 'View'}: ${ctaUrl}` : `${title}\n\n${body}`,
    template: 'notification',
    userId,
  })
}

/** Send a confirmation that the account password was changed. */
async function sendPasswordChangedEmail({ to, name, userId }) {
  const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
  const helpUrl = `${appUrl}/app/settings`
  return send({
    to,
    subject: 'Your password was changed',
    html: templates.passwordChanged({ name, helpUrl }),
    text: `Your ${process.env.APP_NAME ?? 'App'} password was changed. If this wasn't you, review your account now: ${helpUrl}`,
    template: 'password_changed',
    userId,
  })
}

/** Send a notice that the account email address is changing. */
async function sendEmailChangeEmail({ to, name, newEmail, userId }) {
  const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
  const securityUrl = `${appUrl}/app/settings`
  return send({
    to,
    subject: newEmail ? 'Your email address is changing' : 'Your email address may have changed',
    html: templates.emailChange({ name, newEmail, securityUrl }),
    text: newEmail
      ? `We're updating the email on your ${process.env.APP_NAME ?? 'App'} account to ${newEmail}. Review it here: ${securityUrl}`
      : `We're updating the email on your ${process.env.APP_NAME ?? 'App'} account. Review it here: ${securityUrl}`,
    template: 'email_change',
    userId,
  })
}

/** Send an alert to an owner/admin when a new workspace/user signs up. */
async function sendSignupAlertEmail({ to, userName, userEmail, plan, userId }) {
  const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
  const adminUrl = `${appUrl}/admin`
  return send({
    to,
    subject: 'New signup on your workspace',
    html: templates.signupAlert({ userName, userEmail, plan, adminUrl }),
    text: `${userName ?? userEmail ?? 'A new user'} just signed up on ${process.env.APP_NAME ?? 'App'}. Review: ${adminUrl}`,
    template: 'signup_alert',
    userId,
  })
}

/** Send a payment receipt / confirmation after a successful charge. */
async function sendPaymentReceiptEmail({ to, name, amount, planName, invoiceUrl, userId }) {
  const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
  const url = invoiceUrl ?? `${appUrl}/app/billing`
  return send({
    to,
    subject: 'Thanks for your payment',
    html: templates.paymentReceipt({ name, amount, planName, invoiceUrl: url }),
    text: `Your payment of ${amount ?? ''} was received${planName ? ` for ${planName}` : ''}. View invoice: ${url}`,
    template: 'payment_receipt',
    userId,
  })
}

/** Send a confirmation that a subscription has been canceled. */
async function sendSubscriptionCanceledEmail({ to, name, planName, reactivateUrl, userId }) {
  const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
  const url = reactivateUrl ?? `${appUrl}/app/billing`
  return send({
    to,
    subject: 'Your subscription was canceled',
    html: templates.subscriptionCanceled({ name, planName, reactivateUrl: url }),
    text: `Your ${process.env.APP_NAME ?? 'App'} subscription${planName ? ` to ${planName}` : ''} was canceled. Reactivate: ${url}`,
    template: 'subscription_canceled',
    userId,
  })
}

/** Send the transactional email that alerts a user their recurring payment failed. */
async function sendPaymentFailedEmail({ to, name, amount, planName, billingUrl, userId }) {
  const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
  const url = billingUrl ?? `${appUrl}/app/billing`
  return send({
    to,
    subject: `We couldn't process your payment${planName ? ` for ${planName}` : ''}`,
    html: templates.paymentFailed({ name, amount, planName, billingUrl: url }),
    text: `Your payment of ${amount ?? ''} could not be processed${planName ? ` for ${planName}` : ''}. Update your payment method: ${url}`,
    template: 'payment_failed',
    userId,
  })
}

/** Send a security notice when a sign-in is detected from a new device / location. */
async function sendNewDeviceNoticeEmail({ to, name, device, location, ip, reviewUrl, userId }) {
  const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
  const url = reviewUrl ?? `${appUrl}/app/settings`
  return send({
    to,
    subject: 'New sign-in to your account',
    html: templates.newDeviceNotice({ name, device, location, ip, reviewUrl: url }),
    text: `A new device signed in to your ${process.env.APP_NAME ?? 'App'} account. Review activity: ${url}`,
    template: 'new_device_notice',
    userId,
  })
}

/** Reset the cached transport (useful in tests or after config changes). */
function resetTransport() {
  _state = null
}

module.exports = {
  send,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendInvitationEmail,
  sendMagicLinkEmail,
  sendNotificationEmail,
  sendPasswordChangedEmail,
  sendEmailChangeEmail,
  sendSignupAlertEmail,
  sendPaymentReceiptEmail,
  sendSubscriptionCanceledEmail,
  sendPaymentFailedEmail,
  sendNewDeviceNoticeEmail,
  sendSetPasswordEmail,
  resetTransport,
  getTransport,
  setEmailSentCallback,
}
