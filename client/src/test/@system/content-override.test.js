// Contract tests for the per-page text/content override system.
//
// The canonical resolver (client/src/app/lib/@system/content.js) applies a
// per-page @custom → @system import fallback: a product can drop a
// `content/@custom/<page>.js` module to override the default `content/@system/<page>.js`
// copy for THAT page only. These tests lock in the fallback semantics:
//
//   1. mergeContent — @custom always wins on a shared key, while untouched
//      @system keys and @custom-only keys are preserved.
//   2. Real module set — with no product @custom override shipped, only the
//      @system defaults surface (no flash / no blank first paint).
//   3. Namespace isolation — landing/auth/pricing content never leaks across page scopes.
import { mergeContent } from '@/app/lib/@system/content'

import landingSystem from '@/app/content/@system/landing'
import authSystem from '@/app/content/@system/auth'
import pricingSystem from '@/app/content/@system/pricing'

// Placeholder overrides shipped with the template — deliberately empty so fresh
// products inherit pure @system defaults. When a product edits these files the
// corresponding keys take precedence over @system (verified in unit tests below).
import authCustom from '@/app/content/@custom/auth'
import pricingCustom from '@/app/content/@custom/pricing'

const KEYS = {
  landing: Object.keys(landingSystem),
  auth: Object.keys(authSystem),
  pricing: Object.keys(pricingSystem),
}

describe('content override system — mergeContent', () => {
  it('lets @custom override an existing @system key', () => {
    const merged = mergeContent({ heroTitle: 'Build faster' }, { heroTitle: 'Branded hero' })
    expect(merged.heroTitle).toBe('Branded hero')
  })

  it('falls back to @system keys not overridden by @custom', () => {
    const merged = mergeContent(
      { heroTitle: 'Build faster', ctaButton: 'Get Started' },
      { heroTitle: 'Branded hero' }
    )
    expect(merged.heroTitle).toBe('Branded hero') // @custom
    expect(merged.ctaButton).toBe('Get Started') // untouched @system preserved
  })

  it('adds keys that exist only in @custom', () => {
    const merged = mergeContent({ heroTitle: 'Build faster' }, { promo: 'Launch week — 20% off' })
    expect(merged.promo).toBe('Launch week — 20% off')
    expect(merged.heroTitle).toBe('Build faster')
  })

  it('degrades to @system when no @custom override is provided', () => {
    expect(mergeContent({ title: 'x' }, undefined)).toEqual({ title: 'x' })
    expect(mergeContent(undefined, {})).toEqual({})
    expect(mergeContent({ a: 1 }, {})).toEqual({ a: 1 })
  })
})

describe('content override system — real @custom/@system fallback per page', () => {
  // Fresh product: no @custom overrides shipped ⇒ merged content === @system defaults.
  it('auth falls back entirely to @system when @custom is empty', () => {
    const merged = mergeContent(authSystem, authCustom)
    expect(authCustom).toEqual({}) // template placeholder
    expect(merged).toEqual(authSystem)
    expect(merged.loginTitle).toBe('Welcome back')
    expect(merged.registerTitle).toBe('Create your account')
  })

  it('pricing falls back entirely to @system when @custom is empty', () => {
    const merged = mergeContent(pricingSystem, pricingCustom)
    expect(pricingCustom).toEqual({})
    expect(merged).toEqual(pricingSystem)
    expect(merged.title).toBe('Simple, transparent pricing')
  })

  it('an @custom override for one key still preserves the rest of @system', () => {
    // Simulate a product overriding just the pricing call-to-action.
    const merged = mergeContent(pricingSystem, { title: 'Plans that scale' })
    expect(merged.title).toBe('Plans that scale')
    expect(merged.subtitle).toBe(pricingSystem.subtitle)
  })
})

describe('content override system — per-page namespace isolation', () => {
  it('keeps auth, pricing and landing key sets disjoint', () => {
    const { auth, landing, pricing } = KEYS
    const pairwise = (a, b) => a.some((k) => b.includes(k))
    expect(pairwise(auth, landing)).toBe(false)
    expect(pairwise(auth, pricing)).toBe(false)
    expect(pairwise(landing, pricing)).toBe(false)
  })

  it('contains every key the fallback consumers rely on', () => {
    // AuthPage reads login/register titles + subtitles.
    expect(KEYS.auth).toEqual(
      expect.arrayContaining(['loginTitle', 'loginSubtitle', 'registerTitle', 'registerSubtitle'])
    )
    // PricingPage reads the page heading + empty-state body.
    expect(KEYS.pricing).toEqual(expect.arrayContaining(['title', 'subtitle', 'noPlansBody']))
  })
})
