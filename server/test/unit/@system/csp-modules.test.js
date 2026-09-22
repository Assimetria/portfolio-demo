/**
 * CSP defaults ↔ billing module.
 *
 * buildCspDirectives() only adds the Stripe hosts to its DEFAULT script/connect/
 * frame sources when the billing module is enabled. Explicit brand.json values
 * still win either way, and the resolved repo policy (informational template,
 * billing off) carries no Stripe host at all.
 */

const { buildCspDirectives, loadBrandCsp } = require('../../../src/lib/@system/Middleware/security')
const { loadModules, DEFAULT_BRAND_PATH } = require('../../../src/lib/@system/Helpers/modules')

const STRIPE = /stripe\.com/

function hosts(d) {
  return [...d.scriptSrc, ...d.connectSrc, ...d.frameSrc]
}

describe('buildCspDirectives defaults and the billing module', () => {
  it('adds Stripe hosts to the defaults when billing is on', () => {
    const d = buildCspDirectives({}, { hash: null, billing: true })
    expect(d.scriptSrc).toContain('https://js.stripe.com')
    expect(d.connectSrc).toContain('https://api.stripe.com')
    expect(d.frameSrc).toEqual(['https://js.stripe.com'])
  })

  it('omits every Stripe host from the defaults when billing is off', () => {
    const d = buildCspDirectives({}, { hash: null, billing: false })
    expect(hosts(d).some((h) => STRIPE.test(h))).toBe(false)
    expect(d.scriptSrc).toEqual(["'self'"])
    expect(d.connectSrc).toEqual(["'self'", 'https://*.plausible.io'])
    expect(d.frameSrc).toEqual(["'self'"])
  })

  it('keeps explicit brand.json sources verbatim regardless of the module', () => {
    const brand = { scriptSrc: ["'self'", 'https://js.stripe.com'], frameSrc: ["'self'", 'https://www.openstreetmap.org'] }
    const on = buildCspDirectives(brand, { hash: null, billing: true })
    const off = buildCspDirectives(brand, { hash: null, billing: false })
    expect(on.scriptSrc).toEqual(brand.scriptSrc)
    expect(off.scriptSrc).toEqual(brand.scriptSrc)
    expect(off.frameSrc).toEqual(brand.frameSrc)
  })

  it('resolves the repo policy (billing off in brand.json) without any Stripe host', () => {
    // brand.json resolved without env so another suite's MODULES_JSON cannot leak in
    const { billing } = loadModules(DEFAULT_BRAND_PATH, {})
    expect(billing).toBe(false)
    const d = buildCspDirectives(loadBrandCsp(), { hash: null, billing })
    expect(hosts(d).some((h) => STRIPE.test(h))).toBe(false)
    expect(d.frameSrc).toEqual(expect.arrayContaining(['https://www.openstreetmap.org', 'https://www.google.com']))
  })
})
