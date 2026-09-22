// @system — Contract tests for scripts/lib/site-brand.cjs: the brand.json `site`
// block → content-layer mapping and the three-layer merge rule shared by
// client/src/config/index.js (runtime), scripts/apply-brand.js (generator) and
// client/webpack.config.mjs (index.html fallback + JSON-LD).
import {
  deepMerge,
  mergeSiteLayers,
  brandSiteToContent,
  normaliseAddress,
  generateSiteBrandModule,
  validateBrandSite,
  SITE_GENERATED_MARKER,
} from '../../../../scripts/lib/site-brand.cjs'
import systemSite from '@/app/content/@system/site'
import brand from '../../../../brand.json'

describe('deepMerge / mergeSiteLayers', () => {
  it('merges objects per key, replaces arrays, ignores undefined', () => {
    const merged = deepMerge(
      { a: { x: 1, y: 2 }, list: [1, 2, 3], keep: 'k' },
      { a: { y: 20, z: 30 }, list: [9], gone: undefined },
    )
    expect(merged).toEqual({ a: { x: 1, y: 20, z: 30 }, list: [9], keep: 'k' })
  })

  it('applies the layers lowest → highest: system < generated < custom', () => {
    const system = { contact: { email: 'sys@x', phone: '1' }, nav: { links: [{ label: 'A', href: '#a' }] } }
    const generated = { contact: { phone: '2' }, nav: { links: [{ label: 'B', href: '#b' }] } }
    const custom = { contact: { phone: '3' } }
    const merged = mergeSiteLayers(system, generated, custom)
    expect(merged.contact).toEqual({ email: 'sys@x', phone: '3' })
    expect(merged.nav.links).toEqual([{ label: 'B', href: '#b' }])
    // inputs untouched
    expect(system.contact.phone).toBe('1')
  })

  it('tolerates missing layers', () => {
    expect(mergeSiteLayers({ a: 1 }, undefined, null)).toEqual({ a: 1 })
  })
})

describe('brandSiteToContent — brand.json `site` → content fragment', () => {
  const site = {
    locale: 'pt-PT',
    nav: [{ label: 'Menu', href: '/menu' }, { label: '', href: '#x' }, 'junk'],
    navCta: { label: 'Reservar', href: '#contact' },
    contact: {
      email: 'ola@casa.pt',
      phone: '+351 21 000 0000',
      address: { street: 'Rua A 1', postalCode: '1000-001', city: 'Lisboa', country: 'Portugal' },
      hours: ['Ter–Dom 12:00–23:00'],
      openingHours: ['Tu-Su 12:00-23:00'],
    },
    social: { instagram: 'https://instagram.com/casa', twitter: '' },
    footer: { tagline: 'Desde 1985', copyright: '', legalLinks: [{ label: 'Privacidade', href: '/privacy' }] },
    seo: { titleTemplate: '{name} · {tagline}', description: 'Restaurante em Lisboa', ogImage: '/og.png', businessType: 'Restaurant' },
    analytics: { provider: 'Plausible', id: 'casa.pt' },
  }

  it('maps every provisioning field onto the content model', () => {
    const c = brandSiteToContent(site)
    expect(c.locale).toBe('pt-PT')
    expect(c.nav).toEqual({ links: [{ label: 'Menu', href: '/menu' }], ctaLabel: 'Reservar', ctaHref: '#contact' })
    expect(c.contact.email).toBe('ola@casa.pt')
    expect(c.contact.address).toEqual({
      lines: ['Rua A 1', '1000-001 Lisboa', 'Portugal'],
      street: 'Rua A 1',
      postalCode: '1000-001',
      city: 'Lisboa',
      country: 'Portugal',
    })
    expect(c.contact.openingHours).toEqual(['Tu-Su 12:00-23:00'])
    expect(c.footer.social).toEqual({ instagram: 'https://instagram.com/casa' })
    expect(c.footer.tagline).toBe('Desde 1985')
    expect(c.footer.legalLinks).toEqual([{ label: 'Privacidade', href: '/privacy' }])
    expect(c.seo).toEqual({ titleTemplate: '{name} · {tagline}', description: 'Restaurante em Lisboa', ogImage: '/og.png', businessType: 'Restaurant' })
    expect(c.analytics).toEqual({ provider: 'plausible', id: 'casa.pt' })
  })

  it('prunes empty values so unset brand.json fields fall through to the layer below', () => {
    const c = brandSiteToContent({ contact: { email: '', phone: '  ' }, social: { linkedin: '' }, footer: { copyright: '' }, seo: { description: '' } })
    expect(c).toEqual({})
    const merged = mergeSiteLayers({ contact: { email: 'default@x' } }, c, {})
    expect(merged.contact.email).toBe('default@x')
  })

  it('drops invalid schema types and unknown analytics providers (reported by validateBrandSite)', () => {
    const c = brandSiteToContent({ seo: { businessType: 'not a type' }, analytics: { provider: 'gtag', id: 'G-1' } })
    expect(c.seo).toBeUndefined()
    expect(c.analytics).toEqual({ id: 'G-1' })
    const warnings = validateBrandSite({ seo: { businessType: 'not a type' }, analytics: { provider: 'gtag' } })
    expect(warnings.some((w) => w.includes('businessType'))).toBe(true)
    expect(warnings.some((w) => w.includes('provider'))).toBe(true)
  })

  it('returns {} for a missing or malformed site block', () => {
    expect(brandSiteToContent(undefined)).toEqual({})
    expect(brandSiteToContent('nope')).toEqual({})
    expect(brandSiteToContent([])).toEqual({})
  })
})

describe('normaliseAddress', () => {
  it('accepts a string, a list of lines, or a structured object', () => {
    expect(normaliseAddress('Rua A 1, Lisboa')).toEqual({ lines: ['Rua A 1, Lisboa'] })
    expect(normaliseAddress(['Rua A 1', 'Lisboa'])).toEqual({ lines: ['Rua A 1', 'Lisboa'] })
    expect(normaliseAddress({ lines: ['Given'], city: 'Lisboa' })).toEqual({ lines: ['Given'], city: 'Lisboa' })
    expect(normaliseAddress({ street: 'Rua A 1' })).toEqual({ lines: ['Rua A 1'], street: 'Rua A 1' })
    expect(normaliseAddress('')).toBeUndefined()
  })
})

describe('generateSiteBrandModule — client/src/app/content/@generated/site.brand.js', () => {
  it('emits a marked, deterministic ES module', () => {
    const a = generateSiteBrandModule(brand.site, { companyName: brand.companyName })
    const b = generateSiteBrandModule(JSON.parse(JSON.stringify(brand.site)), { companyName: brand.companyName })
    expect(a).toBe(b)
    expect(a).toContain(SITE_GENERATED_MARKER)
    expect(a).toMatch(/^\/\/ @generated/)
    expect(a).toContain('\nexport default {')
    expect(a).not.toContain('import ')
  })

  it('emits `export default {}` when brand.json has no site block (SaaS-shaped brand.json)', () => {
    expect(generateSiteBrandModule(undefined)).toContain('export default {}')
  })
})

describe('template brand.json `site` block', () => {
  it('carries the provisioning schema with template placeholder values (no example.com)', () => {
    expect(brand.site).toBeDefined()
    for (const key of ['locale', 'nav', 'contact', 'social', 'footer', 'seo', 'analytics']) expect(brand.site).toHaveProperty(key)
    expect(JSON.stringify(brand.site)).not.toContain('example.com')
    expect(brand.site.seo.businessType).toBe('ProfessionalService')
    expect(brand.site.analytics).toEqual({ provider: 'none', id: '' })
    expect(Array.isArray(brand.site.nav)).toBe(true)
  })

  it('every key it sets exists in the @system content model (no dead provisioning fields)', () => {
    const generated = brandSiteToContent(brand.site)
    const walk = (gen, sys, trail = []) => {
      for (const key of Object.keys(gen)) {
        expect(sys).toHaveProperty(key)
        if (gen[key] && typeof gen[key] === 'object' && !Array.isArray(gen[key])) walk(gen[key], sys[key], [...trail, key])
      }
    }
    walk(generated, systemSite)
  })
})
