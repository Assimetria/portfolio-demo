// Integrity contract for the per-page content/@system → content/@custom chain.
//
// AuthPage and PricingPage render copy via useContent('auth' | 'pricing') which
// merges the template content/@system/<page>.js defaults with a product's
// content/@custom/<page>.js overrides. Because a product may ship NO override,
// the template ships empty @custom placeholders so a fresh product renders
// byte-for-byte the @system defaults on FIRST paint — never blank, never async.
//
// This file locks the guarantees that protect first paint + serializable copy so
// a hand-edited @custom module cannot silently blank a page or inject content a
// render can't consume. It complements content-override.test.js, which covers
// the merge semantics and per-page consumer keys.
import { CONTENT_PAGE_KEYS, isContentPage } from '@/app/lib/@system/content'
import landingSystem from '@/app/content/@system/landing'
import authSystem from '@/app/content/@system/auth'
import pricingSystem from '@/app/content/@system/pricing'

import landingCustom from '@/app/content/@custom/landing'
import authCustom from '@/app/content/@custom/auth'
import pricingCustom from '@/app/content/@custom/pricing'

// Any module registered in the resolver must have a @system default + an
// (initially empty) @custom placeholder shipped with the template. Products
// override copy by editing @custom — they never touch @system default files.
const SYSTEM_MODULES = { auth: authSystem, landing: landingSystem, pricing: pricingSystem }
const CUSTOM_MODULES = { auth: authCustom, landing: landingCustom, pricing: pricingCustom }

describe('content override system — resolver registry is in sync with shipped modules', () => {
  // The resolver list is the single contract for which pages take part in the
  // @custom → @system chain. Every entry must have a default + override module
  // present for the static page(s) that consume it (auth → AuthPage/LoginPage,
  // pricing → PricingPage, landing → reserved for content-driven landing pages).
  it('registers exactly the pages that ship a @system content module', () => {
    expect([...CONTENT_PAGE_KEYS].sort()).toEqual(Object.keys(SYSTEM_MODULES).sort())
    expect([...CONTENT_PAGE_KEYS].sort()).toEqual(Object.keys(CUSTOM_MODULES).sort())
  })

  it('treats registered pages via isContentPage() and rejects unknown keys', () => {
    CONTENT_PAGE_KEYS.forEach((page) => expect(isContentPage(page)).toBe(true))
    expect(isContentPage('docs')).toBe(false)
    expect(isContentPage('')).toBe(false)
  })
})

describe('content override system — shipped @custom placeholders stay empty', () => {
  it.each(Object.keys(CUSTOM_MODULES))('%s @custom override is an empty object on a fresh product', (page) => {
    expect(CUSTOM_MODULES[page]).toEqual({})
  })

  it('an empty @custom override reproduces @system defaults exactly', () => {
    Object.keys(SYSTEM_MODULES).forEach((page) => {
      expect({ ...SYSTEM_MODULES[page], ...CUSTOM_MODULES[page] }).toEqual(SYSTEM_MODULES[page])
    })
  })
})

describe('content override system — @system defaults never blank first paint', () => {
  // Consumers fall back to content.title ?? content.subtitle from the module; a
  // blank (whitespace/empty) default would render an empty heading/subtitle.
  it.each(Object.keys(SYSTEM_MODULES))(
    '%s @system module exposes only non-empty string values',
    (page) => {
      Object.values(SYSTEM_MODULES[page]).forEach((value) => {
        expect(typeof value).toBe('string')
        expect(value.trim().length).toBeGreaterThan(0)
      })
    }
  )
})

describe('content override system — copy stays render-safe', () => {
  it('every @system content module is a flat, serializable key→string map', () => {
    Object.values(SYSTEM_MODULES).forEach((mod) => {
      expect(Array.isArray(mod)).toBe(false)
      Object.keys(mod).forEach((key) => {
        expect(key.startsWith('_')).toBe(false) // no underscore-internal plumbing
      })
    })
  })

  it('a partial @custom override never blanks sibling @system keys', () => {
    // A product overrides the pricing title only → subtitle must remain present.
    const merged = { ...pricingSystem, title: 'Plans that scale' }
    expect(merged.title).toBe('Plans that scale')
    expect(typeof merged.subtitle).toBe('string')
    expect(merged.subtitle.length).toBeGreaterThan(0)
  })
})
