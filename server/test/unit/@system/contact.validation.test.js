/**
 * Unit tests — contact form validation (informational template).
 *
 * Covers the zod schemas behind POST/GET/PATCH /api/contact, the honeypot
 * check and the notification email body builder. No DB, no network.
 */

const {
  ContactSubmissionBody,
  ContactListQuery,
  ContactIdParams,
} = require('../../../src/lib/@system/Validation/schemas/@system/contact')

// Load only the pure helpers — avoid pulling express/pg/email into this test.
jest.mock('../../../src/lib/@system/PostgreSQL', () => ({}))
jest.mock('../../../src/lib/@system/Email', () => ({ send: jest.fn() }))
jest.mock('../../../src/lib/@system/Helpers/auth', () => ({
  authenticate: (_req, _res, next) => next(),
  requireAdmin: (_req, _res, next) => next(),
}))
jest.mock('../../../src/lib/@system/RateLimit', () => ({
  createLimiter: () => (_req, _res, next) => next(),
}))
jest.mock('../../../src/lib/@system/Logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))

const { isHoneypotTripped, buildNotification } = require('../../../src/api/@system/contact')

const valid = {
  name: 'Ana Silva',
  email: 'Ana@Example.com',
  message: 'I would like to book a consultation next week.',
}

describe('ContactSubmissionBody', () => {
  it('accepts a minimal valid submission', () => {
    const r = ContactSubmissionBody.safeParse(valid)
    expect(r.success).toBe(true)
    expect(r.data.name).toBe('Ana Silva')
  })

  it('trims whitespace from strings', () => {
    const r = ContactSubmissionBody.safeParse({ ...valid, name: '  Ana  ', message: `  ${valid.message}  ` })
    expect(r.success).toBe(true)
    expect(r.data.name).toBe('Ana')
    expect(r.data.message).toBe(valid.message)
  })

  it('rejects a missing or too-short name', () => {
    expect(ContactSubmissionBody.safeParse({ ...valid, name: undefined }).success).toBe(false)
    expect(ContactSubmissionBody.safeParse({ ...valid, name: 'A' }).success).toBe(false)
  })

  it('rejects an invalid email', () => {
    const r = ContactSubmissionBody.safeParse({ ...valid, email: 'not-an-email' })
    expect(r.success).toBe(false)
    expect(r.error.issues[0].path).toEqual(['email'])
  })

  it('rejects a message shorter than 10 characters', () => {
    const r = ContactSubmissionBody.safeParse({ ...valid, message: 'hi' })
    expect(r.success).toBe(false)
    expect(r.error.issues[0].path).toEqual(['message'])
  })

  it('rejects an over-long message (>5000 chars)', () => {
    expect(ContactSubmissionBody.safeParse({ ...valid, message: 'x'.repeat(5001) }).success).toBe(false)
  })

  it('accepts optional phone/subject/sourcePath as empty strings or omitted', () => {
    expect(ContactSubmissionBody.safeParse({ ...valid, phone: '', subject: '', sourcePath: '' }).success).toBe(true)
    expect(ContactSubmissionBody.safeParse({ ...valid, phone: '+351 210 000 000', subject: 'Pricing', sourcePath: '/' }).success).toBe(true)
  })

  it('accepts the honeypot field (rejection is done by the route, not the schema)', () => {
    const r = ContactSubmissionBody.safeParse({ ...valid, website: 'http://spam.example' })
    expect(r.success).toBe(true)
  })
})

describe('isHoneypotTripped', () => {
  it('is false when the honeypot is absent or empty', () => {
    expect(isHoneypotTripped({})).toBe(false)
    expect(isHoneypotTripped({ website: '' })).toBe(false)
    expect(isHoneypotTripped({ website: '   ' })).toBe(false)
  })
  it('is true when the honeypot has any content', () => {
    expect(isHoneypotTripped({ website: 'http://spam.example' })).toBe(true)
  })
})

describe('ContactListQuery', () => {
  it('applies defaults', () => {
    const r = ContactListQuery.safeParse({})
    expect(r.success).toBe(true)
    expect(r.data).toEqual({ page: 1, limit: 25, unread: undefined })
  })
  it('coerces page/limit and parses unread flag', () => {
    const r = ContactListQuery.safeParse({ page: '3', limit: '10', unread: 'true' })
    expect(r.success).toBe(true)
    expect(r.data).toEqual({ page: 3, limit: 10, unread: true })
    expect(ContactListQuery.safeParse({ unread: '0' }).data.unread).toBe(false)
  })
  it('caps limit at 100', () => {
    expect(ContactListQuery.safeParse({ limit: '500' }).success).toBe(false)
  })
})

describe('ContactIdParams', () => {
  it('coerces a numeric id', () => {
    expect(ContactIdParams.safeParse({ id: '42' }).data).toEqual({ id: 42 })
  })
  it('rejects non-positive or non-numeric ids', () => {
    expect(ContactIdParams.safeParse({ id: '0' }).success).toBe(false)
    expect(ContactIdParams.safeParse({ id: 'abc' }).success).toBe(false)
  })
})

describe('buildNotification', () => {
  it('escapes HTML in user-supplied fields and includes the message in text', () => {
    const { html, text } = buildNotification({
      id: 1,
      name: '<script>alert(1)</script>',
      email: 'a@b.co',
      message: 'Hello & welcome',
      source_path: '/',
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('Hello &amp; welcome')
    expect(text).toContain('Hello & welcome')
    expect(text).toContain('Email: a@b.co')
  })
})
