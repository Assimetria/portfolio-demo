'use strict'

// Unit tests for brand.json → CSP mapping in Middleware/security.js.
// brand.json is written camelCase by Orkosi provisioning; the legacy
// snake_case shape must keep working too.

const fs = require('fs')
const os = require('os')
const path = require('path')

const { normalizeBrandCsp, loadBrandCsp, buildCspDirectives } = require('../../../src/lib/@system/Middleware/security')

function writeTempBrand(obj) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-'))
  const p = path.join(dir, 'brand.json')
  fs.writeFileSync(p, JSON.stringify(obj))
  return p
}

describe('normalizeBrandCsp', () => {
  it('accepts camelCase keys', () => {
    const out = normalizeBrandCsp({ scriptSrc: ["'self'", 'https://a'], connectSrc: ["'self'"] })
    expect(out).toEqual({ scriptSrc: ["'self'", 'https://a'], connectSrc: ["'self'"] })
  })

  it('accepts snake_case and kebab-case keys', () => {
    expect(normalizeBrandCsp({ script_src: ['x'], 'connect-src': ['y'] })).toEqual({ scriptSrc: ['x'], connectSrc: ['y'] })
  })

  it('ignores non-array / non-string values', () => {
    expect(normalizeBrandCsp({ scriptSrc: 'https://a', connectSrc: [1, 2], fontSrc: null })).toEqual({})
    expect(normalizeBrandCsp(null)).toEqual({})
  })
})

describe('loadBrandCsp', () => {
  it('reads the camelCase securityHeaders.contentSecurityPolicy block', () => {
    const p = writeTempBrand({ companyName: 'X', securityHeaders: { contentSecurityPolicy: { scriptSrc: ["'self'", 'https://plausible.io'], connectSrc: ["'self'", 'https://plausible.io'] } } })
    expect(loadBrandCsp(p)).toEqual({ scriptSrc: ["'self'", 'https://plausible.io'], connectSrc: ["'self'", 'https://plausible.io'] })
  })

  it('reads the legacy snake_case block', () => {
    const p = writeTempBrand({ security_headers: { content_security_policy: { script_src: ["'self'"], connect_src: ["'self'", 'https://api.x'] } } })
    expect(loadBrandCsp(p)).toEqual({ scriptSrc: ["'self'"], connectSrc: ["'self'", 'https://api.x'] })
  })

  it('returns {} for a missing or malformed file', () => {
    expect(loadBrandCsp('/nonexistent/brand.json')).toEqual({})
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-'))
    const p = path.join(dir, 'brand.json')
    fs.writeFileSync(p, '{ not json')
    expect(loadBrandCsp(p)).toEqual({})
  })

  it('the repo brand.json (camelCase) is actually picked up', () => {
    const csp = loadBrandCsp()
    expect(Array.isArray(csp.scriptSrc)).toBe(true)
    expect(csp.scriptSrc).toContain("'self'")
  })
})

describe('buildCspDirectives', () => {
  it('uses brand values and injects the inline hash after self', () => {
    const d = buildCspDirectives({ scriptSrc: ["'self'", 'https://js.stripe.com'], connectSrc: ["'self'", 'https://api.x'] }, { hash: "'sha256-abc'", isProd: true })
    expect(d.scriptSrc).toEqual(["'self'", "'sha256-abc'", 'https://js.stripe.com'])
    expect(d.connectSrc).toEqual(["'self'", 'https://api.x'])
    expect(d.upgradeInsecureRequests).toEqual([])
  })

  it('always allows Google Fonts CSS + font files', () => {
    const d = buildCspDirectives({}, { hash: null, isProd: false })
    expect(d.styleSrc).toContain('https://fonts.googleapis.com')
    expect(d.fontSrc).toContain('https://fonts.gstatic.com')
    expect(d.fontSrc).toContain("'self'")
    expect(d.upgradeInsecureRequests).toBeNull()
  })

  it('does not duplicate Google Fonts hosts when brand.json already lists them', () => {
    const d = buildCspDirectives({ styleSrc: ["'self'", 'https://fonts.googleapis.com'], fontSrc: ['https://fonts.gstatic.com'] }, { hash: null })
    expect(d.styleSrc.filter((s) => s === 'https://fonts.googleapis.com')).toHaveLength(1)
    expect(d.fontSrc).toEqual(['https://fonts.gstatic.com'])
  })

  it('keeps hard security defaults regardless of brand.json', () => {
    const d = buildCspDirectives({ scriptSrc: ["'self'"] }, { hash: null })
    expect(d.objectSrc).toEqual(["'none'"])
    expect(d.defaultSrc).toEqual(["'self'"])
  })
})
