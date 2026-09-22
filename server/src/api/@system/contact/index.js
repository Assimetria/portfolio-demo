// @system — Contact form API for the informational website template.
//
//   GET    /api/contact/config       public — { data: { retentionDays, turnstile: { siteKey } } }
//   POST   /api/contact              public, rate limited, honeypot + optional Turnstile
//   GET    /api/contact              admin — paginated inbox
//   PATCH  /api/contact/:id/read     admin — mark read (idempotent)
//   PATCH  /api/contact/:id/unread   admin — mark unread
//   DELETE /api/contact/:id          admin — GDPR erasure (Art. 17)
//
// Response envelope follows the @system convention: `{ data }` for a single
// resource, `{ data, pagination }` for lists, `{ message }` for errors and
// message-only successes. Validation errors add `errors: [{ field, message }]`.
//
// CSRF: POST /api/contact is NOT exempt from the app-level CSRF middleware.
// The client submits through lib/@system/api.js, which fetches the
// double-submit token from GET /api/csrf-token like every other browser form
// (register/login do the same). Anonymous visitors get the cookie on that GET.
//
// SQL lives in db/repos/@system/ContactRepo.js. Submissions are tenant-less
// (one product = one site). A notification email goes to
// CONTACT_NOTIFY_EMAIL (falls back to EMAIL_FROM); email failures are logged
// and never fail the request.

const express = require('express')
const router = express.Router()
const { authenticate, requireAdmin } = require('../../../lib/@system/Helpers/auth')
const ContactRepo = require('../../../db/repos/@system/ContactRepo')
const logger = require('../../../lib/@system/Logger')
const Email = require('../../../lib/@system/Email')
const { validate } = require('../../../lib/@system/Validation')
const { createLimiter } = require('../../../lib/@system/RateLimit')
const {
  ContactSubmissionBody,
  ContactListQuery,
  ContactIdParams,
} = require('../../../lib/@system/Validation/schemas/@system/contact')
const contactConfig = require('./config')
const { verifyTurnstile } = require('./turnstile')

const adminGuard = [authenticate, requireAdmin]

// 5 submissions per IP per 15 minutes — generous for humans, hostile to scripts.
const contactLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  prefix: 'rl:contact:',
  message: 'Too many messages sent from this address. Please try again later.',
})

const UNAVAILABLE_MESSAGE = 'Contact form is temporarily unavailable'

/** Honeypot: any non-empty value means a bot filled the hidden field. */
function isHoneypotTripped(body) {
  return typeof body.website === 'string' && body.website.trim().length > 0
}

/** True when the error is Postgres "relation does not exist" (migration not run). */
function isMissingTable(err) {
  return err && err.code === '42P01'
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function buildNotification(sub) {
  const rows = [
    ['Name', sub.name],
    ['Email', sub.email],
    ['Phone', sub.phone || '—'],
    ['Subject', sub.subject || '—'],
    ['Page', sub.source_path || '—'],
    ['IP', sub.ip || '—'],
  ]
  const html = `
    <h2 style="font-family:sans-serif;margin:0 0 12px">New contact form submission</h2>
    <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">
      ${rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${k}</td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`).join('')}
    </table>
    <p style="font-family:sans-serif;font-size:14px;white-space:pre-wrap;margin-top:16px">${escapeHtml(sub.message)}</p>
  `
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\n${sub.message}`
  return { html, text }
}

async function notify(sub) {
  const to = process.env.CONTACT_NOTIFY_EMAIL || process.env.EMAIL_FROM
  if (!to) {
    logger.warn({ id: sub.id }, '[contact] no CONTACT_NOTIFY_EMAIL / EMAIL_FROM configured — notification skipped')
    return
  }
  try {
    const { html, text } = buildNotification(sub)
    await Email.send({
      to,
      replyTo: sub.email,
      subject: `[Contact] ${sub.subject || sub.name}`,
      html,
      text,
      template: 'contact-notification',
    })
  } catch (err) {
    logger.error({ err, id: sub.id }, '[contact] notification email failed (submission was stored)')
  }
}

/** Serialise a repo row for the API (snake_case columns → camelCase). */
function toSubmission(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? null,
    subject: row.subject ?? null,
    message: row.message,
    sourcePath: row.source_path ?? null,
    createdAt: row.created_at,
    readAt: row.read_at ?? null,
    retentionExpiresAt: row.retention_expires_at ?? null,
  }
}

// GET /api/contact/config — public. Tells the form whether Turnstile is
// enforced (site key only present when the secret is configured too) so the
// client never renders a widget the server will not verify, or vice versa.
// Short public cache: brand.json changes ship with a deploy anyway.
router.get('/contact/config', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300')
  res.json({ data: contactConfig.publicConfig() })
})

// POST /api/contact — public
router.post('/contact', contactLimiter, validate({ body: ContactSubmissionBody }), async (req, res, next) => {
  try {
    if (isHoneypotTripped(req.body)) {
      logger.info({ ip: req.ip }, '[contact] honeypot tripped — rejecting')
      return res.status(400).json({ message: 'Validation failed', errors: [{ field: 'body', message: 'Invalid submission' }] })
    }

    const turnstile = contactConfig.turnstile()
    if (turnstile.enforced) {
      const check = await verifyTurnstile(req.body.turnstileToken, { secretKey: turnstile.secretKey, remoteIp: req.ip })
      if (!check.ok) {
        if (check.reason === 'unavailable') {
          logger.error('[contact] turnstile verification unavailable — refusing submission (fail closed)')
          return res.status(503).json({ message: UNAVAILABLE_MESSAGE })
        }
        logger.info({ ip: req.ip, reason: check.reason, errorCodes: check.errorCodes }, '[contact] turnstile rejected submission')
        return res.status(400).json({
          message: 'Please complete the anti-spam check and try again.',
          errors: [{ field: 'body.turnstileToken', message: 'Anti-spam verification failed' }],
        })
      }
    }

    const { name, email, phone, subject, message, sourcePath } = req.body
    const row = await ContactRepo.create({
      name,
      email: email.toLowerCase(),
      phone: phone || null,
      subject: subject || null,
      message,
      sourcePath: sourcePath || req.get('referer') || null,
      ip: req.ip || null,
      userAgent: (req.get('user-agent') || '').slice(0, 500) || null,
      retentionDays: contactConfig.retentionDays(),
    })

    // Fire-and-forget: the visitor should not wait on SMTP.
    notify(row)

    res.status(201).json({ data: { id: row.id, createdAt: row.created_at } })
  } catch (err) {
    if (isMissingTable(err)) {
      logger.error('[contact] contact_submissions table missing — run migrations')
      return res.status(503).json({ message: UNAVAILABLE_MESSAGE })
    }
    next(err)
  }
})

// GET /api/contact — admin list
router.get('/contact', ...adminGuard, validate({ query: ContactListQuery }), async (req, res, next) => {
  try {
    const { page, limit, unread } = req.query
    const { rows, total, unreadCount } = await ContactRepo.list({ page, limit, unread })
    res.json({
      data: rows.map(toSubmission),
      pagination: { total, page, pages: Math.max(1, Math.ceil(total / limit)), limit },
      unreadCount,
    })
  } catch (err) {
    // A missing table is an operator error (migration not run) — surface it
    // instead of masquerading as an empty inbox.
    if (isMissingTable(err)) {
      logger.error('[contact] contact_submissions table missing — run migrations')
      return res.status(503).json({ message: UNAVAILABLE_MESSAGE })
    }
    next(err)
  }
})

// PATCH /api/contact/:id/read — admin mark read (idempotent)
router.patch('/contact/:id/read', ...adminGuard, validate({ params: ContactIdParams }), async (req, res, next) => {
  try {
    const row = await ContactRepo.markRead(req.params.id)
    if (!row) return res.status(404).json({ message: 'Submission not found' })
    res.json({ data: { id: row.id, readAt: row.read_at } })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/contact/:id/unread — admin mark unread
router.patch('/contact/:id/unread', ...adminGuard, validate({ params: ContactIdParams }), async (req, res, next) => {
  try {
    const row = await ContactRepo.markUnread(req.params.id)
    if (!row) return res.status(404).json({ message: 'Submission not found' })
    res.json({ data: { id: row.id, readAt: null } })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/contact/:id — admin, GDPR erasure
router.delete('/contact/:id', ...adminGuard, validate({ params: ContactIdParams }), async (req, res, next) => {
  try {
    const removed = await ContactRepo.remove(req.params.id)
    if (!removed) return res.status(404).json({ message: 'Submission not found' })
    logger.info({ id: req.params.id, adminId: req.user?.id }, '[contact] submission deleted')
    res.json({ message: 'Submission deleted' })
  } catch (err) {
    next(err)
  }
})

module.exports = router
module.exports.isHoneypotTripped = isHoneypotTripped
module.exports.buildNotification = buildNotification
module.exports.toSubmission = toSubmission
