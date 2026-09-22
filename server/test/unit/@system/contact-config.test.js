/**
 * Unit tests — contact-form configuration (api/@system/contact/config.js).
 *
 * Resolution order under test:
 *   retentionDays: brand.site.contact.retentionDays → CONTACT_RETENTION_DAYS → 180
 *   turnstile:     enforced only when brand siteKey AND TURNSTILE_SECRET_KEY are set
 */

const config = require('../../../src/api/@system/contact/config')

const ENV_KEYS = ['CONTACT_RETENTION_DAYS', 'TURNSTILE_SECRET_KEY']
const snapshot = {}

beforeEach(() => {
  for (const k of ENV_KEYS) { snapshot[k] = process.env[k]; delete process.env[k] }
})
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (snapshot[k] === undefined) delete process.env[k]
    else process.env[k] = snapshot[k]
  }
})

describe('retentionDays', () => {
  it('defaults to 180 with an empty brand and no env', () => {
    expect(config.retentionDays({})).toBe(180)
    expect(config.DEFAULT_RETENTION_DAYS).toBe(180)
  })

  it('reads brand.site.contact.retentionDays first', () => {
    process.env.CONTACT_RETENTION_DAYS = '90'
    expect(config.retentionDays({ site: { contact: { retentionDays: 30 } } })).toBe(30)
  })

  it('falls back to CONTACT_RETENTION_DAYS', () => {
    process.env.CONTACT_RETENTION_DAYS = '90'
    expect(config.retentionDays({})).toBe(90)
    expect(config.retentionDays({ site: {} })).toBe(90)
    expect(config.retentionDays({ site: { contact: {} } })).toBe(90)
  })

  it('ignores invalid values (non-integer, zero, negative, absurd) and keeps resolving', () => {
    process.env.CONTACT_RETENTION_DAYS = 'soon'
    expect(config.retentionDays({ site: { contact: { retentionDays: 12.5 } } })).toBe(180)
    expect(config.retentionDays({ site: { contact: { retentionDays: 0 } } })).toBe(180)
    expect(config.retentionDays({ site: { contact: { retentionDays: -3 } } })).toBe(180)
    expect(config.retentionDays({ site: { contact: { retentionDays: 99999 } } })).toBe(180)
    process.env.CONTACT_RETENTION_DAYS = '60'
    expect(config.retentionDays({ site: { contact: { retentionDays: 'x' } } })).toBe(60)
  })

  it('tolerates a malformed site block', () => {
    expect(config.retentionDays({ site: 'nope' })).toBe(180)
    expect(config.retentionDays({ site: { contact: null } })).toBe(180)
    expect(config.retentionDays(null)).toBe(180)
  })
})

describe('turnstile', () => {
  it('is not enforced with no configuration', () => {
    expect(config.turnstile({})).toEqual({ siteKey: '', secretKey: '', enforced: false })
  })

  it('is not enforced with a site key but no secret (and hides the key)', () => {
    const t = config.turnstile({ site: { contact: { turnstile: { siteKey: '1x000' } } } })
    expect(t.enforced).toBe(false)
    expect(t.siteKey).toBe('')
  })

  it('is not enforced with a secret but no site key', () => {
    process.env.TURNSTILE_SECRET_KEY = 'shh'
    expect(config.turnstile({}).enforced).toBe(false)
  })

  it('is enforced when both are present', () => {
    process.env.TURNSTILE_SECRET_KEY = ' shh '
    const t = config.turnstile({ site: { contact: { turnstile: { siteKey: ' 1x000 ' } } } })
    expect(t).toEqual({ siteKey: '1x000', secretKey: 'shh', enforced: true })
  })
})

describe('publicConfig', () => {
  it('never includes the secret', () => {
    process.env.TURNSTILE_SECRET_KEY = 'shh'
    const pub = config.publicConfig({ site: { contact: { turnstile: { siteKey: '1x000' }, retentionDays: 14 } } })
    expect(pub).toEqual({ retentionDays: 14, turnstile: { siteKey: '1x000' } })
    expect(JSON.stringify(pub)).not.toContain('shh')
  })
})
