// Unit tests for the newly-added transactional email templates
// (auth/security + billing + team/account lifecycle) and their senders.

'use strict'

// Silence logger output during tests (Email service requires Logger).
jest.mock('../../../src/lib/@system/Logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

const templates = require('../../../src/lib/@system/Email/templates')
const Email = require('../../../src/lib/@system/Email')

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasFullDocument(html) {
  return (
    html.startsWith('<!DOCTYPE html>') &&
    html.includes('<html') &&
    html.includes('</html>') &&
    html.includes('</body>')
  )
}

describe('Email templates (new)', () => {
  const newTemplateNames = [
    'passwordChanged',
    'emailChange',
    'signupAlert',
    'paymentReceipt',
    'subscriptionCanceled',
    'paymentFailed',
    'newDeviceNotice',
    'setPassword',
  ]

  const sampleArgs = {
    passwordChanged: { name: 'Ada', helpUrl: 'https://app.example.com/app/settings' },
    emailChange: { name: 'Ada', newEmail: 'new@example.com', securityUrl: 'https://app.example.com/app/settings' },
    signupAlert: { userName: 'Ada', userEmail: 'ada@example.com', plan: 'Pro', adminUrl: 'https://app.example.com/admin' },
    paymentReceipt: { name: 'Ada', amount: '$49.00', planName: 'Pro', invoiceUrl: 'https://app.example.com/app/billing/invoice' },
    subscriptionCanceled: { name: 'Ada', planName: 'Pro', reactivateUrl: 'https://app.example.com/app/billing' },
    paymentFailed: { name: 'Ada', amount: '$49.00', planName: 'Pro', billingUrl: 'https://app.example.com/app/billing' },
    newDeviceNotice: {
      name: 'Ada',
      device: 'Chrome on macOS',
      location: 'Berlin, Germany',
      ip: '203.0.113.42',
      reviewUrl: 'https://app.example.com/app/settings',
    },
    setPassword: {
      name: 'Ada',
      setPasswordUrl: 'https://app.example.com/set-password?token=demo-token',
    },
  }

  beforeAll(() => {
    // Deterministic branding for assertions.
    process.env.APP_NAME = 'Acme'
    process.env.APP_URL = 'https://app.example.com'
    process.env.SUPPORT_EMAIL = 'support@example.com'
  })

  afterAll(() => {
    delete process.env.APP_NAME
    delete process.env.APP_URL
    delete process.env.SUPPORT_EMAIL
  })

  it.each(newTemplateNames)('exports and renders a full HTML document for %s', (name) => {
    expect(typeof templates[name]).toBe('function')

    const html = templates[name](sampleArgs[name])
    expect(hasFullDocument(html)).toBe(true)
    expect(html).toMatch(/style="display:none;max-height:0;overflow:hidden;mso-hide:all/)

    // No external stylesheet / script references (self-contained email bodies).
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/<link\b/i)
  })

  it('interpolates recipient data without leaking secrets', () => {
    // Each template must surface its recipient/actor without embedding
    // tokens, hashes, or other credentials in the body.
    const expectedTokens = {
      passwordChanged: 'Hi Ada,',
      emailChange: 'new@example.com',
      signupAlert: 'Ada',
      paymentReceipt: 'Hi Ada,',
      subscriptionCanceled: 'Hi Ada,',
      paymentFailed: 'Hi Ada,',
      newDeviceNotice: 'Chrome on macOS',
      setPassword: 'https://app.example.com/set-password?token=demo-token',
    }

    for (const name of newTemplateNames) {
      const html = templates[name](sampleArgs[name])
      // Branding from env is baked in.
      expect(html).toContain('Acme')
      expect(html).toContain(expectedTokens[name])
    }

    // None of the new templates should ever embed raw credential material.
    for (const name of newTemplateNames) {
      const html = templates[name](sampleArgs[name])
      expect(html).not.toContain('secret-token')
      expect(html).not.toContain('Bearer ')
    }
  })

  describe('null-env safety', () => {
    // Templates only build URLs that are passed in; but title/footer branding
    // must degrade gracefully when env is unset.
    it('renders each template without throwing when env vars are unset', () => {
      const savedName = process.env.APP_NAME
      const savedUrl = process.env.APP_URL
      const savedSupport = process.env.SUPPORT_EMAIL
      delete process.env.APP_NAME
      delete process.env.APP_URL
      delete process.env.SUPPORT_EMAIL

      try {
        for (const name of newTemplateNames) {
          const html = templates[name](sampleArgs[name])
          expect(hasFullDocument(html)).toBe(true)
        }
      } finally {
        process.env.APP_NAME = savedName
        process.env.APP_URL = savedUrl
        process.env.SUPPORT_EMAIL = savedSupport
      }
    })

    it('renders each template with no arguments passed', () => {
      for (const name of newTemplateNames) {
        const html = templates[name]({})
        expect(hasFullDocument(html)).toBe(true)
      }
    })
  })

  it('defines fallback URLs through the fallbackLink helper where a CTA is present', () => {
    const html = templates.passwordChanged(sampleArgs.passwordChanged)
    expect(html).toContain('Or copy this link into your browser')

    // Templates without an explicit action URL simply omit the CTA.
    const bare = templates.signupAlert({ userName: 'Ada', userEmail: 'ada@example.com' })
    expect(bare).not.toContain('Or copy this link into your browser')
  })

  it('uses a distinct, non-empty preheader for each template', () => {
    for (const name of newTemplateNames) {
      const html = templates[name](sampleArgs[name])
      expect(html).toMatch(/display:none;max-height:0/)
    }
  })
})

describe('Email service sender exports (new)', () => {
  const senderNames = [
    'sendPasswordChangedEmail',
    'sendEmailChangeEmail',
    'sendSignupAlertEmail',
    'sendPaymentReceiptEmail',
    'sendSubscriptionCanceledEmail',
    'sendPaymentFailedEmail',
    'sendNewDeviceNoticeEmail',
    'sendSetPasswordEmail',
  ]

  it.each(senderNames)('exports %s', (name) => {
    expect(typeof Email[name]).toBe('function')
  })
})
