// @system config resolver — info shallow-merge + text deep-merge contract
// task #1024401 criterion #2: @/config must let @custom win on overlap while
// retaining @system keys that @custom leaves unset.
import { describe, it, expect } from 'vitest'
import { info, text, site } from '@/config'
// @custom/info.js is generated from brand.json by scripts/apply-brand.js
// (runs in prebuild), so brand.json is the expected value — not a literal.
import brand from '../../../../brand.json'
import systemSite from '@/app/content/@system/site'
import generatedSite from '@/app/content/@generated/site.brand'
import customSite from '@/app/content/@custom/site'
import { mergeSiteLayers } from '../../../../scripts/lib/site-brand.cjs'

describe('@/config resolver (@system + @custom merge)', () => {
  describe('info (shallow spread — @custom wins)', () => {
    it('lets @custom name (from brand.json companyName) override the @system default', () => {
      expect(info.name).toBe(brand.companyName)
    })

    it('lets @custom tagline (from brand.json) override the @system default', () => {
      expect(info.tagline).toBe(brand.tagline)
    })

    it('retains @system keys that @custom does not set', () => {
      expect(typeof info.companyAddress).toBe('string')
      expect(info.companyAddress).toBe('')
      expect(info).toHaveProperty('social')
    })

    it('exposes a resolvable brand color', () => {
      expect(typeof info.brandColor).toBe('string')
    })
  })

  describe('text (deep merge — @custom wins per key only)', () => {
    it('lets @custom text win on overlapping keys', () => {
      expect(text.landing.hero.title).toBe('Product Template')
      // @custom-specific phrasing proves the @custom text object won the deep merge
      expect(text.landing.hero.subtitle).toContain('A production-ready SaaS starter')
    })

    it('keeps @system sibling keys that @custom does not override', () => {
      expect(text.landing.hero.cta).toBe('Get Started Free')
    })

    it('retains @system sections untouched by @custom', () => {
      // @custom only overrides landing.hero — the rest of landing stays @system
      expect(Array.isArray(text.landing.stats)).toBe(true)
      expect(Array.isArray(text.landing.logoCompanies)).toBe(true)
    })
  })

  describe('site (informational content — deep merge of content/@system + @custom site.js)', () => {
    it('exposes every section the SitePage composes', () => {
      for (const key of ['features', 'nav', 'hero', 'about', 'services', 'team', 'testimonials', 'contact', 'map', 'footer']) {
        expect(site).toHaveProperty(key)
      }
    })

    it('ships informational defaults (pricing off, contact form + map on)', () => {
      expect(site.features.showPricing).toBe(false)
      expect(site.features.showContactForm).toBe(true)
      expect(site.features.showMap).toBe(true)
      expect(site.map.provider).toBe('osm')
    })

    it('has renderable content in every list section', () => {
      expect(site.nav.links.length).toBeGreaterThan(0)
      expect(site.services.items.length).toBeGreaterThan(0)
      expect(site.team.members.length).toBeGreaterThan(0)
      expect(site.testimonials.items.length).toBeGreaterThan(0)
      expect(site.contact.address.lines.length).toBeGreaterThan(0)
    })

    // Layer 2: content/@generated/site.brand.js is emitted from brand.json `site`
    // by scripts/apply-brand.js (prebuild), so brand.json is the expected value.
    it('takes provisioning values from the generated brand.json layer', () => {
      expect(site.locale).toBe(brand.site.locale)
      expect(site.nav.links).toEqual(brand.site.nav)
      expect(site.contact.phone).toBe(brand.site.contact.phone)
      expect(site.contact.address.street).toBe(brand.site.contact.address.street)
      expect(site.contact.address.lines[0]).toBe(brand.site.contact.address.street)
      expect(site.contact.openingHours).toEqual(brand.site.contact.openingHours)
      expect(site.seo.businessType).toBe(brand.site.seo.businessType)
      expect(site.analytics.provider).toBe(brand.site.analytics.provider)
    })

    it('lets an empty brand.json field fall through to the @system default instead of blanking it', () => {
      expect(brand.site.contact.email).toBe('')
      expect(generatedSite.contact.email).toBeUndefined()
      expect(site.contact.email).toBe(systemSite.contact.email)
    })

    it('lets @custom win over the generated layer, which wins over @system', () => {
      const merged = mergeSiteLayers(
        { contact: { phone: 'system', email: 'system' }, locale: 'en' },
        { contact: { phone: 'generated', email: 'generated' } },
        { contact: { phone: 'custom' } },
      )
      expect(merged.contact).toEqual({ phone: 'custom', email: 'generated' })
      expect(merged.locale).toBe('en')
      // the shipped @custom layer is the empty placeholder, so site === system ⊕ generated
      expect(customSite).toEqual({})
      expect(site).toEqual(mergeSiteLayers(systemSite, generatedSite, {}))
    })
  })
})
