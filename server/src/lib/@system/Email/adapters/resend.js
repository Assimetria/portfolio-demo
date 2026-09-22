// @system — Resend email adapter
// Sends email via Resend's REST API (https://api.resend.com/emails).
// Uses native Node.js fetch (Node 18+) — no SDK dependency required.
//
// Required env vars:
//   RESEND_API_KEY  — Resend API key (re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)
//   EMAIL_FROM      — Sender address e.g. "App <noreply@yourdomain.com>"
//
// Optional:
//   RESEND_REPLY_TO — Reply-to address
//
// Usage (via Email index — do not call directly):
//   const adapter = require('./adapters/resend')
//   await adapter.send({ from, to, subject, html, text })

'use strict'

const logger = require('../../Logger')

const RESEND_API_URL = 'https://api.resend.com/emails'

/**
 * Validate that required env vars are present.
 * Throws if RESEND_API_KEY is missing.
 */
function assertConfig() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('[Email/Resend] RESEND_API_KEY env var is required')
  }
}

/**
 * Send an email via Resend's REST API.
 *
 * @param {object} opts
 * @param {string}   opts.from      Sender (e.g. "App <noreply@domain.com>")
 * @param {string}   opts.to        Recipient address (or comma-separated list)
 * @param {string}   opts.subject   Subject line
 * @param {string}   opts.html      HTML body
 * @param {string}  [opts.text]     Plain-text fallback
 * @param {string}  [opts.replyTo]  Reply-to override (falls back to RESEND_REPLY_TO)
 * @param {string[]} [opts.cc]      CC recipients
 * @param {string[]} [opts.bcc]     BCC recipients
 * @param {object[]} [opts.attachments] Attachments array [{ filename, content (base64) }]
 * @returns {Promise<{ messageId: string, provider: 'resend' }>}
 */
async function send({ from, to, subject, html, text, replyTo, cc, bcc, attachments }) {
  assertConfig()

  const apiKey = process.env.RESEND_API_KEY
  const replyToAddr = replyTo ?? process.env.RESEND_REPLY_TO ?? undefined

  // Resend expects `to` as an array
  const toArray = Array.isArray(to) ? to : [to]

  const payload = {
    from,
    to: toArray,
    subject,
    html,
    ...(text && { text }),
    ...(replyToAddr && { reply_to: replyToAddr }),
    ...(cc?.length && { cc: Array.isArray(cc) ? cc : [cc] }),
    ...(bcc?.length && { bcc: Array.isArray(bcc) ? bcc : [bcc] }),
    ...(attachments?.length && { attachments }),
  }

  let response
  try {
    response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  } catch (networkErr) {
    logger.error({ err: networkErr, to, subject }, '[Email/Resend] Network error')
    throw new Error(`[Email/Resend] Network error: ${networkErr.message}`)
  }

  let body
  try {
    body = await response.json()
  } catch {
    body = {}
  }

  if (!response.ok) {
    const msg = body?.message ?? body?.error ?? `HTTP ${response.status}`
    const err = new Error(`[Email/Resend] API error: ${msg}`)
    err.statusCode = response.status
    err.resendBody = body
    logger.error({ statusCode: response.status, body, to, subject }, '[Email/Resend] API error')
    throw err
  }

  const messageId = body.id ?? 'unknown'
  logger.info({ messageId, to, subject }, '[Email/Resend] sent')

  return { messageId, provider: 'resend' }
}

/**
 * Verify the Resend API key is valid by calling the /domains endpoint.
 * Returns { valid: true } on success, { valid: false, reason } on failure.
 * Does NOT throw — safe to call in health checks.
 */
async function verify() {
  if (!process.env.RESEND_API_KEY) {
    return { valid: false, reason: 'RESEND_API_KEY not set' }
  }

  try {
    const response = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    })

    if (response.status === 200) return { valid: true }
    if (response.status === 401) return { valid: false, reason: 'Invalid API key' }
    return { valid: false, reason: `Unexpected status ${response.status}` }
  } catch (err) {
    return { valid: false, reason: `Network error: ${err.message}` }
  }
}

module.exports = { send, verify }
