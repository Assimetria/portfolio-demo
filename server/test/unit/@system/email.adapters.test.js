// Unit tests for Email adapters: Resend (native API) + SMTP (nodemailer)

'use strict'

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock fetch globally (Node 18 built-in or jest polyfill)
global.fetch = jest.fn()

// Mock nodemailer — prevent real connections
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn(),
    verify: jest.fn(),
  })),
}))

// Silence logger output during tests
jest.mock('../../../src/lib/@system/Logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

const resendAdapter = require('../../../src/lib/@system/Email/adapters/resend')
const smtpAdapter = require('../../../src/lib/@system/Email/adapters/smtp')
const nodemailer = require('nodemailer')

// ── Resend adapter ────────────────────────────────────────────────────────────

describe('Email/adapters/resend', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.RESEND_API_KEY = 're_testkey_1234567890abcdef'
  })

  afterEach(() => {
    delete process.env.RESEND_API_KEY
    delete process.env.RESEND_REPLY_TO
  })

  describe('send()', () => {
    it('calls Resend API with correct payload and returns messageId', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'msg_abc123' }),
      })

      const result = await resendAdapter.send({
        from: 'App <noreply@example.com>',
        to: 'user@example.com',
        subject: 'Test subject',
        html: '<p>Hello</p>',
        text: 'Hello',
      })

      expect(fetch).toHaveBeenCalledTimes(1)
      const [url, opts] = fetch.mock.calls[0]
      expect(url).toBe('https://api.resend.com/emails')
      expect(opts.method).toBe('POST')
      expect(opts.headers.Authorization).toBe('Bearer re_testkey_1234567890abcdef')

      const body = JSON.parse(opts.body)
      expect(body.to).toEqual(['user@example.com'])
      expect(body.subject).toBe('Test subject')
      expect(body.html).toBe('<p>Hello</p>')
      expect(body.text).toBe('Hello')

      expect(result).toEqual({ messageId: 'msg_abc123', provider: 'resend' })
    })

    it('wraps `to` string in an array', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'msg_xyz' }),
      })

      await resendAdapter.send({
        from: 'noreply@example.com',
        to: 'single@example.com',
        subject: 'Hi',
        html: '<p>Hi</p>',
      })

      const body = JSON.parse(fetch.mock.calls[0][1].body)
      expect(Array.isArray(body.to)).toBe(true)
      expect(body.to).toEqual(['single@example.com'])
    })

    it('includes reply_to from RESEND_REPLY_TO env var', async () => {
      process.env.RESEND_REPLY_TO = 'support@example.com'
      fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'msg_1' }) })

      await resendAdapter.send({
        from: 'noreply@example.com',
        to: 'user@example.com',
        subject: 'Hi',
        html: '<p>Hi</p>',
      })

      const body = JSON.parse(fetch.mock.calls[0][1].body)
      expect(body.reply_to).toBe('support@example.com')
    })

    it('includes cc and bcc when provided', async () => {
      fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'msg_2' }) })

      await resendAdapter.send({
        from: 'noreply@example.com',
        to: 'user@example.com',
        subject: 'Hi',
        html: '<p>Hi</p>',
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
      })

      const body = JSON.parse(fetch.mock.calls[0][1].body)
      expect(body.cc).toEqual(['cc@example.com'])
      expect(body.bcc).toEqual(['bcc@example.com'])
    })

    it('throws when RESEND_API_KEY is missing', async () => {
      delete process.env.RESEND_API_KEY
      await expect(
        resendAdapter.send({ from: 'a@b.com', to: 'c@d.com', subject: 'X', html: '<p/>' }),
      ).rejects.toThrow('RESEND_API_KEY')
    })

    it('throws on non-ok API response with error message', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ message: 'Invalid from address' }),
      })

      await expect(
        resendAdapter.send({ from: 'bad', to: 'c@d.com', subject: 'X', html: '<p/>' }),
      ).rejects.toThrow('Invalid from address')
    })

    it('throws on network failure', async () => {
      fetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

      await expect(
        resendAdapter.send({ from: 'a@b.com', to: 'c@d.com', subject: 'X', html: '<p/>' }),
      ).rejects.toThrow('Network error')
    })

    it('uses `to` array as-is when already an array', async () => {
      fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'msg_3' }) })

      await resendAdapter.send({
        from: 'noreply@example.com',
        to: ['a@example.com', 'b@example.com'],
        subject: 'Hi',
        html: '<p>Hi</p>',
      })

      const body = JSON.parse(fetch.mock.calls[0][1].body)
      expect(body.to).toEqual(['a@example.com', 'b@example.com'])
    })
  })

  describe('verify()', () => {
    it('returns { valid: true } when API key is valid', async () => {
      fetch.mockResolvedValueOnce({ status: 200 })
      const result = await resendAdapter.verify()
      expect(result).toEqual({ valid: true })
    })

    it('returns { valid: false } when API key is invalid (401)', async () => {
      fetch.mockResolvedValueOnce({ status: 401 })
      const result = await resendAdapter.verify()
      expect(result.valid).toBe(false)
      expect(result.reason).toMatch(/Invalid API key/)
    })

    it('returns { valid: false } when RESEND_API_KEY is not set', async () => {
      delete process.env.RESEND_API_KEY
      const result = await resendAdapter.verify()
      expect(result.valid).toBe(false)
      expect(result.reason).toMatch(/not set/)
    })

    it('returns { valid: false } on network error without throwing', async () => {
      fetch.mockRejectedValueOnce(new Error('timeout'))
      const result = await resendAdapter.verify()
      expect(result.valid).toBe(false)
      expect(result.reason).toMatch(/Network error/)
    })
  })
})

// ── SMTP adapter ──────────────────────────────────────────────────────────────

describe('Email/adapters/smtp', () => {
  let mockTransporter

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_PORT = '587'
    process.env.SMTP_USER = 'user@example.com'
    process.env.SMTP_PASS = 'secret'

    mockTransporter = {
      sendMail: jest.fn(),
      verify: jest.fn(),
    }
    nodemailer.createTransport.mockReturnValue(mockTransporter)
  })

  afterEach(() => {
    delete process.env.SMTP_HOST
    delete process.env.SMTP_PORT
    delete process.env.SMTP_USER
    delete process.env.SMTP_PASS
    delete process.env.SMTP_SECURE
    delete process.env.SMTP_POOL
    delete process.env.SMTP_IGNORE_TLS
  })

  describe('createTransport()', () => {
    it('creates a nodemailer transporter with correct config', () => {
      smtpAdapter.createTransport()

      expect(nodemailer.createTransport).toHaveBeenCalledTimes(1)
      const [config] = nodemailer.createTransport.mock.calls[0]
      expect(config.host).toBe('smtp.example.com')
      expect(config.port).toBe(587)
      expect(config.auth.user).toBe('user@example.com')
      expect(config.auth.pass).toBe('secret')
    })

    it('sets secure=true when port is 465', () => {
      process.env.SMTP_PORT = '465'
      smtpAdapter.createTransport()
      const [config] = nodemailer.createTransport.mock.calls[0]
      expect(config.secure).toBe(true)
    })

    it('sets secure=false when port is 587', () => {
      process.env.SMTP_PORT = '587'
      smtpAdapter.createTransport()
      const [config] = nodemailer.createTransport.mock.calls[0]
      expect(config.secure).toBe(false)
    })

    it('respects SMTP_SECURE=true override', () => {
      process.env.SMTP_PORT = '2525'
      process.env.SMTP_SECURE = 'true'
      smtpAdapter.createTransport()
      const [config] = nodemailer.createTransport.mock.calls[0]
      expect(config.secure).toBe(true)
    })

    it('enables pool when SMTP_POOL=true', () => {
      process.env.SMTP_POOL = 'true'
      smtpAdapter.createTransport()
      const [config] = nodemailer.createTransport.mock.calls[0]
      expect(config.pool).toBe(true)
    })

    it('throws when SMTP_HOST is not set', () => {
      delete process.env.SMTP_HOST
      expect(() => smtpAdapter.createTransport()).toThrow('SMTP_HOST')
    })

    it('creates transport without auth when SMTP_USER/PASS are absent', () => {
      delete process.env.SMTP_USER
      delete process.env.SMTP_PASS
      smtpAdapter.createTransport()
      const [config] = nodemailer.createTransport.mock.calls[0]
      expect(config.auth).toBeUndefined()
    })
  })

  describe('send()', () => {
    it('calls sendMail with correct options and returns messageId', async () => {
      mockTransporter.sendMail.mockResolvedValueOnce({ messageId: '<abc@smtp>' })

      const result = await smtpAdapter.send({
        transporter: mockTransporter,
        from: 'App <noreply@example.com>',
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Hi</p>',
        text: 'Hi',
      })

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1)
      const [opts] = mockTransporter.sendMail.mock.calls[0]
      expect(opts.from).toBe('App <noreply@example.com>')
      expect(opts.to).toBe('user@example.com')
      expect(opts.subject).toBe('Test')
      expect(opts.html).toBe('<p>Hi</p>')
      expect(opts.text).toBe('Hi')

      expect(result).toEqual({ messageId: '<abc@smtp>', provider: 'smtp' })
    })

    it('includes replyTo when provided', async () => {
      mockTransporter.sendMail.mockResolvedValueOnce({ messageId: '<x>' })

      await smtpAdapter.send({
        transporter: mockTransporter,
        from: 'noreply@example.com',
        to: 'user@example.com',
        subject: 'X',
        html: '<p/> ',
        replyTo: 'support@example.com',
      })

      const [opts] = mockTransporter.sendMail.mock.calls[0]
      expect(opts.replyTo).toBe('support@example.com')
    })

    it('includes cc and bcc when provided', async () => {
      mockTransporter.sendMail.mockResolvedValueOnce({ messageId: '<y>' })

      await smtpAdapter.send({
        transporter: mockTransporter,
        from: 'noreply@example.com',
        to: 'user@example.com',
        subject: 'Y',
        html: '<p/>',
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
      })

      const [opts] = mockTransporter.sendMail.mock.calls[0]
      expect(opts.cc).toEqual(['cc@example.com'])
      expect(opts.bcc).toEqual(['bcc@example.com'])
    })

    it('re-throws sendMail errors', async () => {
      mockTransporter.sendMail.mockRejectedValueOnce(new Error('Connection refused'))

      await expect(
        smtpAdapter.send({
          transporter: mockTransporter,
          from: 'a@b.com',
          to: 'c@d.com',
          subject: 'X',
          html: '<p/>',
        }),
      ).rejects.toThrow('Connection refused')
    })
  })

  describe('verify()', () => {
    it('returns { valid: true } when transporter.verify() resolves', async () => {
      mockTransporter.verify.mockResolvedValueOnce(true)
      const result = await smtpAdapter.verify(mockTransporter)
      expect(result).toEqual({ valid: true })
    })

    it('returns { valid: false, reason } when transporter.verify() rejects', async () => {
      mockTransporter.verify.mockRejectedValueOnce(new Error('ECONNREFUSED'))
      const result = await smtpAdapter.verify(mockTransporter)
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('ECONNREFUSED')
    })
  })
})

// ── Email index (integration with adapter selection) ──────────────────────────

describe('Email index — provider selection', () => {
  let Email

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()

    // Clear all email-related env vars
    delete process.env.EMAIL_PROVIDER
    delete process.env.RESEND_API_KEY
    delete process.env.SMTP_HOST
    delete process.env.AWS_ACCESS_KEY_ID
    delete process.env.AWS_SECRET_ACCESS_KEY

    // Re-mock logger after resetModules
    jest.mock('../../../src/lib/@system/Logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }))
  })

  it('selects resend provider when RESEND_API_KEY is set and no SMTP_HOST', () => {
    process.env.RESEND_API_KEY = 're_testkey'
    Email = require('../../../src/lib/@system/Email')
    const { provider } = Email.getTransport()
    expect(provider).toBe('resend')
  })

  it('selects console provider when no credentials are set', () => {
    Email = require('../../../src/lib/@system/Email')
    const { provider } = Email.getTransport()
    expect(provider).toBe('console')
  })

  it('selects resend when EMAIL_PROVIDER=resend even without SMTP_HOST', () => {
    process.env.EMAIL_PROVIDER = 'resend'
    process.env.RESEND_API_KEY = 're_key'
    Email = require('../../../src/lib/@system/Email')
    const { provider } = Email.getTransport()
    expect(provider).toBe('resend')
  })

  it('falls back to console when EMAIL_PROVIDER=resend but no RESEND_API_KEY', () => {
    process.env.EMAIL_PROVIDER = 'resend'
    // No RESEND_API_KEY
    Email = require('../../../src/lib/@system/Email')
    const { provider } = Email.getTransport()
    expect(provider).toBe('console')
  })
})
