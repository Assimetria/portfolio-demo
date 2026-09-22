/**
 * @system Tests for the network/IP helpers (Helpers/network.js)
 *
 * Covers IP normalisation (IPv4-mapped IPv6, ::folding), private-range
 * classification and best-effort client-IP extraction from a request object.
 *
 * Pure helpers — no DB or network I/O — so these run fast in the unit suite.
 */
'use strict'

const {
  normalizeIp,
  isPrivateIp,
  clientIpFromRequest,
  getClientIp,
  sanitizeIp,
} = require('../../../src/lib/@system/Helpers/network')

function reqIPOnly(value, overrides = {}) {
  return { ip: value, headers: {}, ...overrides }
}

describe('normalizeIp', () => {
  it('compacts IPv4-mapped IPv6 addresses', () => {
    expect(normalizeIp('::ffff:192.0.2.1')).toEqual({ ip: '192.0.2.1', valid: true })
  })

  it('maps ::1 loopback to 127.0.0.1', () => {
    expect(normalizeIp('::1')).toEqual({ ip: '127.0.0.1', valid: true })
  })

  it('keeps a plain IPv4 string as-is', () => {
    expect(normalizeIp('  8.8.8.8  ')).toEqual({ ip: '8.8.8.8', valid: true })
  })

  it('takes the leading entry of an X-Forwarded-For chain', () => {
    expect(normalizeIp('203.0.113.9, 10.0.0.1')).toEqual({ ip: '203.0.113.9', valid: true })
  })

  it('rejects malformed values', () => {
    expect(normalizeIp('not-an-ip')).toEqual({ ip: '', valid: false })
    expect(normalizeIp('')).toEqual({ ip: '', valid: false })
    expect(normalizeIp(undefined)).toEqual({ ip: '', valid: false })
    expect(normalizeIp('999.1.1.1')).toEqual({ ip: '', valid: false })
  })

  it('accepts plain IPv6', () => {
    const r = normalizeIp('2001:DB8::1')
    expect(r.valid).toBe(true)
    expect(r.ip.toLowerCase()).toBe(r.ip)
  })

  it('parses a bracketed IPv6 host and maps loopback consistently', () => {
    expect(normalizeIp('[::1]:443')).toEqual({ ip: '127.0.0.1', valid: true })
    const v6 = normalizeIp('[2001:db8:85a3::8a2e:370:7334]:8080')
    expect(v6.valid).toBe(true)
    expect(v6.ip).toBe('2001:db8:85a3::8a2e:370:7334')
  })

  it('strips a numeric port from an IPv4 host:port value', () => {
    expect(normalizeIp('203.0.113.9:8080')).toEqual({ ip: '203.0.113.9', valid: true })
  })
})

describe('isPrivateIp', () => {
  const truthy = [
    '127.0.0.1',
    '::1',
    '10.0.0.5',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.0.1',
    '100.64.0.1',
  ]
  const falsy = ['8.8.8.8', '93.184.216.34', '203.0.113.7']

  it.each(truthy)('classifies %s as private/loopback', (ip) => {
    expect(isPrivateIp(ip)).toBe(true)
  })

  it.each(falsy)('does not classify %s as private', (ip) => {
    expect(isPrivateIp(ip)).toBe(false)
  })

  it('returns false (not true) for unparseable input', () => {
    expect(isPrivateIp('garbage')).toBe(false)
    expect(isPrivateIp(undefined)).toBe(false)
  })
})

describe('clientIpFromRequest / getClientIp', () => {
  it('prefers req.ip when present', () => {
    const req = reqIPOnly('198.51.100.5', {
      headers: { 'x-forwarded-for': '203.0.113.1' },
      socket: { remoteAddress: '::ffff:10.1.2.3' },
    })
    expect(clientIpFromRequest(req)).toBe('198.51.100.5')
  })

  it('falls back to the first X-Forwarded-For entry', () => {
    const req = reqIPOnly(undefined, {
      headers: { 'x-forwarded-for': ' 203.0.113.9, 10.0.0.1 ' },
    })
    expect(clientIpFromRequest(req)).toBe('203.0.113.9')
  })

  it('falls back to the socket remote address and normalises it', () => {
    const req = reqIPOnly(undefined, {
      socket: { remoteAddress: '::ffff:10.1.2.3' },
    })
    expect(clientIpFromRequest(req)).toBe('10.1.2.3')
  })

  it('getClientIp is an alias returning the same value', () => {
    const req = reqIPOnly('127.0.0.1')
    expect(getClientIp(req)).toBe('127.0.0.1')
  })

  it('returns an empty string when nothing is usable', () => {
    expect(clientIpFromRequest(undefined)).toBe('')
  })
})

describe('sanitizeIp', () => {
  it('returns a normalised string for a valid IP', () => {
    expect(sanitizeIp('::ffff:192.0.2.1')).toBe('192.0.2.1')
  })

  it('returns the fallback for invalid input', () => {
    expect(sanitizeIp('evil}', 'unknown')).toBe('unknown')
    expect(sanitizeIp(undefined)).toBe('')
  })
})
