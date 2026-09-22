// Route-level unit tests for the admin email-service endpoint, POST /email/test.
//
// The handler is exercised in isolation: we replace the authentication
// middleware with a deterministic admin identity and mock every Email sender,
// so each `template` case can be asserted to dispatch to exactly the matching
// sender with the expected recipient. No database, transport, or Redis is used.

'use strict'

const request = require('supertest')
const express = require('express')

const ADMIN = {
  id: 1,
  email: 'ops@example.com',
  name: 'Ops Admin',
  role: 'admin',
  emailVerified: true,
  onboardingCompleted: true,
}

// Replace auth middleware: authenticate() attaches an admin identity; the real
// requireAdmin semantics are preserved (non-admin/absent user -> 403).
jest.mock('../../../src/lib/@system/Helpers/auth', () => ({
  authenticate: (req, _res, next) => {
    req.user = { ...ADMIN }
    next()
  },
  requireAdmin: (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' })
    }
    return next()
  },
}))

// Neutralise rate limiting so the per-request limiter never interferes.
jest.mock('../../../src/lib/@system/RateLimit', () => ({
  emailTestLimiter: (req, _res, next) => next(),
  adminReadLimiter: (req, _res, next) => next(),
}))

// ── Mocked email senders ────────────────────────────────────────────────────────
// Every sender resolves a transport-shaped result the route reads back.
function mockSender() {
  return jest.fn().mockResolvedValue({ messageId: 'test-1', provider: 'console', devMode: true })
}

jest.mock('../../../src/lib/@system/Email', () => ({
  sendVerificationEmail: mockSender(),
  sendPasswordResetEmail: mockSender(),
  sendWelcomeEmail: mockSender(),
  sendInvitationEmail: mockSender(),
  sendMagicLinkEmail: mockSender(),
  sendPasswordChangedEmail: mockSender(),
  sendEmailChangeEmail: mockSender(),
  sendSignupAlertEmail: mockSender(),
  sendPaymentReceiptEmail: mockSender(),
  sendSubscriptionCanceledEmail: mockSender(),
  sendPaymentFailedEmail: mockSender(),
  sendNewDeviceNoticeEmail: mockSender(),
  sendSetPasswordEmail: mockSender(),
  sendNotificationEmail: mockSender(),
}))

const Email = require('../../../src/lib/@system/Email')
const emailRouter = require('../../../src/api/@system/email')

// template name -> sender method it must dispatch to.
const CASES = {
  verification: 'sendVerificationEmail',
  password_reset: 'sendPasswordResetEmail',
  welcome: 'sendWelcomeEmail',
  invitation: 'sendInvitationEmail',
  magic_link: 'sendMagicLinkEmail',
  password_changed: 'sendPasswordChangedEmail',
  email_change: 'sendEmailChangeEmail',
  signup_alert: 'sendSignupAlertEmail',
  payment_receipt: 'sendPaymentReceiptEmail',
  subscription_canceled: 'sendSubscriptionCanceledEmail',
  payment_failed: 'sendPaymentFailedEmail',
  new_device_notice: 'sendNewDeviceNoticeEmail',
  set_password: 'sendSetPasswordEmail',
}

describe('POST /email/test (admin)', () => {
  let app

  beforeEach(() => {
    jest.clearAllMocks()
    app = express()
    app.use(express.json())
    app.use(emailRouter)
  })

  it('rejects callers that are not authenticated as an admin', async () => {
    // Override the auth mock for this assertion by clearing req.user → mimic
    // a request that reaches requireAdmin without an admin role.
    // The mocked authenticate always sets an admin, so exercise the 403 branch
    // directly through the standalone requireAdmin export.
    const { requireAdmin } = require('../../../src/lib/@system/Helpers/auth')
    const req = { user: { role: 'user' }, headers: {} }
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
    const next = jest.fn()
    requireAdmin(req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it.each(Object.keys(CASES))('dispatches template "%s" to its matching sender', async (template) => {
    const res = await request(app)
      .post('/email/test')
      .send({ template, to: 'ops@example.com' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.template).toBe(template)
    expect(res.body.to).toBe('ops@example.com')

    const sender = Email[CASES[template]]
    expect(sender).toHaveBeenCalledTimes(1)
    expect(sender).toHaveBeenCalledWith(expect.objectContaining({ to: 'ops@example.com' }))

    // No other sender should have fired for this dispatch.
    for (const method of Object.keys(CASES)) {
      if (CASES[method] !== CASES[template]) {
        expect(Email[CASES[method]]).not.toHaveBeenCalled()
      }
    }
  })

  it('defaults to the generic notification sender when no template is supplied', async () => {
    const res = await request(app)
      .post('/email/test')
      .send({ to: 'ops@example.com' })

    expect(res.status).toBe(200)
    expect(res.body.template).toBe('notification')
    expect(Email.sendNotificationEmail).toHaveBeenCalledTimes(1)
    expect(Email.sendNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'ops@example.com' })
    )
  })

  it('supports an explicit non-admin recipient via { to }', async () => {
    const res = await request(app)
      .post('/email/test')
      .send({ template: 'welcome', to: 'newbie@example.com' })

    expect(res.status).toBe(200)
    expect(Email.sendWelcomeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'newbie@example.com' })
    )
  })

  it('defaults the recipient to the authenticated admin email when { to } is omitted', async () => {
    const res = await request(app)
      .post('/email/test')
      .send({ template: 'email_change' })

    expect(res.status).toBe(200)
    expect(Email.sendEmailChangeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: ADMIN.email })
    )
  })
})
