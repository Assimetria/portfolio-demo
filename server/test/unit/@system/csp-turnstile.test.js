const fs = require('fs')
const os = require('os')
const path = require('path')
const { buildCspDirectives, loadTurnstileEnabled } = require('../../../src/lib/@system/Middleware/security')

const HOST = 'https://challenges.cloudflare.com'

function writeBrand(obj) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'brand-')), 'brand.json')
  fs.writeFileSync(file, JSON.stringify(obj))
  return file
}

describe('CSP — Cloudflare Turnstile hosts follow brand.json', () => {
  it('is off when no site key is configured (default) and the hosts are absent', () => {
    expect(loadTurnstileEnabled(writeBrand({ site: { contact: { turnstile: { siteKey: '' } } } }))).toBe(false)
    const d = buildCspDirectives({}, { hash: null, isProd: true, billing: false, turnstile: false })
    expect(d.scriptSrc).not.toContain(HOST)
    expect(d.frameSrc).not.toContain(HOST)
  })

  it('adds the widget script and challenge frame hosts when a site key is set', () => {
    expect(loadTurnstileEnabled(writeBrand({ site: { contact: { turnstile: { siteKey: '0x4AAA' } } } }))).toBe(true)
    const d = buildCspDirectives({}, { hash: null, isProd: true, billing: false, turnstile: true })
    expect(d.scriptSrc).toContain(HOST)
    expect(d.frameSrc).toContain(HOST)
    expect(d.scriptSrc).toContain("'self'")
  })

  it('does not duplicate hosts that brand.json already lists', () => {
    const d = buildCspDirectives({ scriptSrc: ["'self'", HOST], frameSrc: [HOST] }, { hash: null, isProd: true, billing: false, turnstile: true })
    expect(d.scriptSrc.filter((h) => h === HOST)).toHaveLength(1)
    expect(d.frameSrc.filter((h) => h === HOST)).toHaveLength(1)
  })
})
