// @system — CSP inline-script contract
//
// Express is the only web server in the production image and sets the
// Content-Security-Policy header from brand.json (Middleware/security.js).
// The template ships NO inline executable <script> in index.html: cookie
// consent is the external /cookie-consent.js plus the React banner, analytics
// and Stripe are external src= scripts, and JSON-LD is non-executable. So the
// runtime script-src must never need (or carry) a sha256 hash. (#41286, #44153)
//
// The dist/ assertions only run when client/dist/index.html exists (CI builds
// the client before running the server suite; locally run `npm run build`).

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../../..')
const DIST_INDEX = path.join(ROOT, 'client/dist/index.html')
const SRC_INDEX = path.join(ROOT, 'client/index.html')
const BRAND_JSON = path.join(ROOT, 'brand.json')

const { buildCspDirectives, loadBrandCsp } = require('../../../src/lib/@system/Middleware/security')

/**
 * Extract inline (executable) script bodies from an HTML string.
 * Excludes type="application/ld+json" / module blocks and src= scripts.
 */
function extractInlineScripts(html) {
  const results = []
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1]
    const body = m[2]
    if (!body.trim()) continue
    if (/type\s*=\s*["'][^"']*json[^"']*["']/i.test(attrs)) continue
    if (/type\s*=\s*["'][^"']*module[^"']*["']/i.test(attrs)) continue
    if (/src\s*=/i.test(attrs)) continue
    results.push(body)
  }
  return results
}

function brandScriptSrc() {
  const brand = JSON.parse(fs.readFileSync(BRAND_JSON, 'utf8'))
  return (
    brand.securityHeaders?.contentSecurityPolicy?.scriptSrc ||
    brand.security_headers?.content_security_policy?.script_src ||
    []
  )
}

describe('CSP inline script hash — intentional absence', () => {
  it('brand.json script-src has no sha256 hash entries', () => {
    expect(brandScriptSrc().filter((s) => s.includes('sha256-'))).toHaveLength(0)
  })

  it('client/index.html template has no inline executable scripts', () => {
    const html = fs.readFileSync(SRC_INDEX, 'utf8')
    expect(extractInlineScripts(html)).toEqual([])
  })

  it("runtime script-src is 'self' + brand.json hosts, without a hash", () => {
    const { scriptSrc } = buildCspDirectives(loadBrandCsp(), { hash: null, isProd: true })
    expect(scriptSrc).toContain("'self'")
    expect(scriptSrc.some((s) => s.includes('sha256-'))).toBe(false)
    expect(scriptSrc).not.toContain("'unsafe-inline'")
  })

  it('a computed hash is inserted right after self (products that add an inline script)', () => {
    const hash = "'sha256-abc123'"
    const { scriptSrc } = buildCspDirectives(loadBrandCsp(), { hash, isProd: true })
    expect(scriptSrc[scriptSrc.indexOf("'self'") + 1]).toBe(hash)
  })
})

const describeDist = fs.existsSync(DIST_INDEX) ? describe : describe.skip

describeDist('built client/dist/index.html', () => {
  const html = fs.existsSync(DIST_INDEX) ? fs.readFileSync(DIST_INDEX, 'utf8') : ''

  it('has no inline executable scripts (cookie consent is external + React)', () => {
    expect(extractInlineScripts(html)).toEqual([])
  })

  it('has no inline <script> immediately before </body>', () => {
    expect(html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)).toBeNull()
  })

  it('loads cookie consent from the external /cookie-consent.js', () => {
    expect(html).toMatch(/<script[^>]*src="\/cookie-consent\.js"[^>]*><\/script>/)
  })
})
