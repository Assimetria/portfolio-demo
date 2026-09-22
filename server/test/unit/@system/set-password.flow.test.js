// Unit tests for the first-login "set password" flow (admin provisioning).
//
// Covers the pieces that are safe to exercise without a database/transport:
// the request/consume body schemas and the first-login email template. The
// endpoint logic itself (tokens, hashing, session invalidation) mirrors the
// proven password-reset consumer and is validated by integration tests.

'use strict'

const {
  ProvisionUserBody,
  SetPasswordBody,
} = require('../../../src/lib/@system/Validation/schemas/@system/user')
const templates = require('../../../src/lib/@system/Email/templates')

function parse(schema, value) {
  return schema.safeParse(value)
}

describe('Set-password flow — request/consume schemas', () => {
  describe('ProvisionUserBody', () => {
    it('accepts a valid provisioning payload', () => {
      const { success } = parse(ProvisionUserBody, { email: 'ada@example.com', name: 'Ada Lovelace' })
      expect(success).toBe(true)
    })

    it('accepts a payload without an optional name', () => {
      const { success } = parse(ProvisionUserBody, { email: 'ada@example.com' })
      expect(success).toBe(true)
    })

    it('rejects a missing email', () => {
      const { success } = parse(ProvisionUserBody, { name: 'Ada' })
      expect(success).toBe(false)
    })

    it('rejects an invalid email', () => {
      const { success } = parse(ProvisionUserBody, { email: 'not-an-email' })
      expect(success).toBe(false)
    })
  })

  describe('SetPasswordBody', () => {
    it('accepts a valid token + password payload', () => {
      const { success } = parse(SetPasswordBody, { token: 'abc123', password: 'S3cret!Passw0rd' })
      expect(success).toBe(true)
    })

    it('rejects payloads missing a token', () => {
      const { success } = parse(SetPasswordBody, { password: 'S3cret!Passw0rd' })
      expect(success).toBe(false)
    })

    it('rejects payloads missing a password', () => {
      const { success } = parse(SetPasswordBody, { token: 'abc123' })
      expect(success).toBe(false)
    })

    it('rejects blank default coercions (empty strings)', () => {
      const { success } = parse(SetPasswordBody, { token: '', password: '' })
      expect(success).toBe(false)
    })
  })
})

describe('Set-password flow — first-login email', () => {
  it('exposes a setPassword template function', () => {
    expect(typeof templates.setPassword).toBe('function')
  })

  it('builds a full HTML document pointing at the set-password page', () => {
    const html = templates.setPassword({
      name: 'Ada',
      setPasswordUrl: 'https://app.example.com/set-password?token=onetime-token',
    })
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('https://app.example.com/set-password?token=onetime-token')
    expect(html).toContain('Set your password')
  })

  it('never prints the raw token in plain text anywhere other than the link', () => {
    // The token must only ever surface inside the action URL — never in the
    // subject line, greeting, or copy.
    const html = templates.setPassword({
      name: 'Ada',
      setPasswordUrl: 'https://app.example.com/set-password?token=super-secret-abc123',
    })
    const tokenMentions = html.split('super-secret-abc123').length - 1
    expect(tokenMentions).toBe(1)
  })

  it('renders gracefully when no name / URL is supplied', () => {
    expect(() => templates.setPassword({})).not.toThrow()
    const html = templates.setPassword({})
    expect(html).toContain('</html>')
  })
})
