/**
 * Unit tests — brand.json → CSP directive loading (Middleware/security.js).
 *
 * brand.json written by Orkosi provisioning is camelCase
 * (securityHeaders.contentSecurityPolicy.{scriptSrc,connectSrc,frameSrc,imgSrc}).
 * The middleware previously read snake_case only, so brand CSP was silently
 * ignored. These tests pin the camelCase path, the snake_case fallback and the
 * new frameSrc/imgSrc support the informational template's map embed relies on.
 */

const fs = require('fs')
const os = require('os')
const path = require('path')

const { loadBrandCsp } = require('../../../src/lib/@system/Middleware/security')

function writeTemp(obj) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'brand-')), 'brand.json')
  fs.writeFileSync(file, JSON.stringify(obj))
  return file
}

describe('loadBrandCsp', () => {
  it('reads camelCase securityHeaders.contentSecurityPolicy', () => {
    const file = writeTemp({
      securityHeaders: {
        contentSecurityPolicy: {
          scriptSrc: ["'self'", 'https://plausible.io'],
          connectSrc: ["'self'"],
          frameSrc: ["'self'", 'https://www.openstreetmap.org', 'https://www.google.com'],
          imgSrc: ["'self'", 'https:', 'data:'],
        },
      },
    })
    expect(loadBrandCsp(file)).toEqual({
      scriptSrc: ["'self'", 'https://plausible.io'],
      connectSrc: ["'self'"],
      frameSrc: ["'self'", 'https://www.openstreetmap.org', 'https://www.google.com'],
      imgSrc: ["'self'", 'https:', 'data:'],
    })
  })

  it('falls back to snake_case security_headers.content_security_policy', () => {
    const file = writeTemp({
      security_headers: { content_security_policy: { script_src: ["'self'"], connect_src: ["'self'", 'https://api.example'] } },
    })
    const csp = loadBrandCsp(file)
    expect(csp.scriptSrc).toEqual(["'self'"])
    expect(csp.connectSrc).toEqual(["'self'", 'https://api.example'])
    expect(csp.frameSrc).toBeUndefined()
    expect(csp.imgSrc).toBeUndefined()
  })

  it('returns undefined directives (so helmet defaults apply) for missing or empty arrays', () => {
    const file = writeTemp({ securityHeaders: { contentSecurityPolicy: { scriptSrc: [] } } })
    expect(loadBrandCsp(file).scriptSrc).toBeUndefined()
  })

  it('returns {} when brand.json is missing or invalid', () => {
    expect(loadBrandCsp('/nonexistent/brand.json')).toEqual({})
  })

  it('the repo brand.json declares frameSrc for OpenStreetMap and Google embeds', () => {
    const csp = loadBrandCsp(path.resolve(__dirname, '../../../../brand.json'))
    expect(csp.frameSrc).toEqual(expect.arrayContaining(["'self'", 'https://www.openstreetmap.org', 'https://www.google.com']))
    expect(csp.imgSrc).toEqual(expect.arrayContaining(['https:', 'data:']))
  })
})
