// Contract test — LandingPage hero copy through the per-page @custom → @system
// content chain (task #1024393).
//
// LandingPage now reads its hero title/subtitle + both CTAs through
// useContent('landing') → @custom/content/landing.js wins, otherwise the shipped
// @system/content/landing default module — exactly like AuthPage via 'auth' and
// PricingPage via 'pricing'. It keeps config text.landing.hero as the highest-
// precedence source so the config driver that is landing's primary copy channel
// can never be blanked while a product is still free to opt into the content
// chain (fallback) copy per page.
//
// Pure unit tests (no DOM, no React) mirroring the sibling files under this dir.
import { mergeContent, copyText, systemDefaultFor } from '@/app/lib/@system/content'

import landingSystem from '@/app/content/@system/landing'
import landingCustom from '@/app/content/@custom/landing'

const HERO_KEYS = ['heroTitle', 'heroSubtitle', 'ctaButton', 'ctaSecondary']

describe('landing hero content chain — LandingPage consumer surface', () => {
  it('ships an empty @custom placeholder so a fresh product inherits @system landing copy', () => {
    expect(landingCustom).toEqual({})
    expect(mergeContent(landingSystem, landingCustom)).toEqual(landingSystem)
  })

  it('registers every hero key LandingPage reads through copyText', () => {
    HERO_KEYS.forEach((key) => {
      // content is useContent('landing'); a blank/unknown value falls back.
      expect(copyText(systemDefaultFor('landing'), key, `fallback:${key}`)).not.toBe(`fallback:${key}`)
      expect(Object.keys(landingSystem)).toEqual(expect.arrayContaining(HERO_KEYS))
    })
  })

  it("a product's @custom landing override wins over the @system default", () => {
    const merged = mergeContent(landingSystem, {
      heroTitle: 'Ship email that delivers',
      heroSubtitle: 'Transactional API with 99.8% deliverability.',
      ctaButton: 'Start Free',
    })
    expect(copyText(merged, 'heroTitle', 'fallback')).toBe('Ship email that delivers')
    expect(copyText(merged, 'heroSubtitle', 'fallback')).toBe('Transactional API with 99.8% deliverability.')
    expect(copyText(merged, 'ctaButton', 'fallback')).toBe('Start Free')
    // untouched @system hero key still resolves.
    expect(copyText(merged, 'ctaSecondary', 'View Pricing')).toBe('View Pricing')
  })

  it('mirrors the LandingPage per-field expression (config → content → literal)', () => {
    // Replicates LandingPage's precedence on one hero field:
    //   const heroTitle = tHero.title ?? copyText(content, 'heroTitle', info.tagline)
    // where tHero = text.landing.hero (config) and content = useContent('landing').
    const resolveHeroTitle = (configValue, content, literal) =>
      configValue ?? copyText(content, 'heroTitle', literal)

    // 1. Config value present → config wins, content/override untouched.
    expect(resolveHeroTitle('Config Hero', systemDefaultFor('landing'), 'literal')).toBe('Config Hero')

    // 2. Config blank/absent → @custom override surfaces via the content chain.
    const custom = mergeContent(landingSystem, { heroTitle: 'Custom Hero' })
    expect(resolveHeroTitle(undefined, custom, 'literal')).toBe('Custom Hero')

    // 3. Config + @custom both absent → shipped @system default (never blank).
    expect(resolveHeroTitle(undefined, systemDefaultFor('landing'), 'literal')).toBe(landingSystem.heroTitle)

    // 4. copyText still guards a blank @system default → literal fallback.
    expect(resolveHeroTitle(undefined, mergeContent({}, {}), 'literal')).toBe('literal')
  })

  it('keeps blank config from blanking first paint (copyText guard is the last seam)', () => {
    // A hand-edited empty config or blank override must never blank the hero.
    expect(copyText(systemDefaultFor('landing'), 'heroTitle', 'Open fallback')).not.toBe('')
    expect(copyText(mergeContent(landingSystem, { heroTitle: '  ' }), 'heroTitle', 'Safe fallback')).toBe('Safe fallback')
  })
})
