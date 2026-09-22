// @system — brand pre-paint contract for the @custom override chain
// task #1024401 criterion #1 + #3: `client/src/main.jsx` reads `info` from @/config
// (via the apply-brand IIFEs) and injects brandColor / accentColor / defaultTheme /
// logo as CSS vars + theme-color BEFORE first paint. Those values must originate from
// @custom/info.js (the never-synced product override) and mirror the authoritative
// repo-root brand.json used by scripts/apply-brand.js.
import { describe, it, expect } from 'vitest'
import { info } from '@/config'
// brand.json lives at the repo root (4 levels up from this test directory).
// apply-brand.js reads it as the source of truth and regenerates @custom/info.js.
import brandConfig from '../../../../brand.json'

describe('@custom brand identity over the @system defaults (pre-paint sources)', () => {
  describe('brandColor / accentColor inject pre-paint CSS vars', () => {
    it('surfaces a resolvable @custom brandColor for the brand-panel background', () => {
      expect(typeof info.brandColor).toBe('string')
      expect(info.brandColor.length).toBeGreaterThan(0)
    })

    it('surfaces a resolvable @custom accentColor for --brand-panel-accent', () => {
      expect(typeof info.accentColor).toBe('string')
      expect(info.accentColor.length).toBeGreaterThan(0)
    })

    it('defaults the theme so the dark-class flicker guard can run pre-paint', () => {
      expect(['light', 'dark', 'system']).toContain(info.defaultTheme)
    })

    it('exposes logo paths used by the brand/sidebar before first meaningful paint', () => {
      expect(typeof info.logo).toBe('string')
      expect(info.logo.length).toBeGreaterThan(0)
    })
  })

  describe('@custom/info.js stays in sync with brand.json (apply-brand regenerate contract)', () => {
    it('keeps brandColor aligned with brand.json primaryColor', () => {
      expect(info.brandColor).toBe(brandConfig.primaryColor)
    })

    it('keeps accentColor aligned with brand.json accentColor', () => {
      expect(info.accentColor).toBe(brandConfig.accentColor)
    })

    it('keeps the product name aligned with brand.json companyName', () => {
      expect(info.name).toBe(brandConfig.companyName)
    })

    it('keeps the default theme aligned with brand.json defaultTheme', () => {
      expect(info.defaultTheme).toBe(brandConfig.defaultTheme)
    })
  })
})
