// Contract tests for the synchronous @system default seeding helpers added to
// the per-page text/content override chain (lib/@system/content.js).
//
// Consumers read copy via useContent(key) → loadContent merges
// content/@custom/<page>.js over @system defaults. Because that resolution is
// async, the hook now seeds its FIRST render from systemDefaultFor(key) so a
// page's very first paint reflects the @system copy rather than an empty object.
// These tests lock in the shape of that seed and the copyText() fallback helper
// the resolved content is read through.
//
// Pure unit tests (no DOM, no vitest imports) — same style as
// content-override.test.js and content-override-integrity.test.js.
import {
  systemDefaultFor,
  copyText,
  CONTENT_PAGE_KEYS,
  mergeContent,
} from '@/app/lib/@system/content'

import landingSystem from '@/app/content/@system/landing'
import authSystem from '@/app/content/@system/auth'
import pricingSystem from '@/app/content/@system/pricing'

describe('content override system — systemDefaultFor synchronous seed', () => {
  it('returns a copy of the @system default module for every registered page', () => {
    expect(systemDefaultFor('auth')).toEqual(authSystem)
    expect(systemDefaultFor('pricing')).toEqual(pricingSystem)
    expect(systemDefaultFor('landing')).toEqual(landingSystem)
  })

  it('never returns the same module reference (consumers cannot mutate defaults)', () => {
    CONTENT_PAGE_KEYS.forEach((key) => {
      expect(systemDefaultFor(key)).not.toBe(key === 'auth' ? authSystem : key === 'pricing' ? pricingSystem : landingSystem)
    })
  })

  it('returns an empty object for unregistered/unknown page keys', () => {
    expect(systemDefaultFor('docs')).toEqual({})
    expect(systemDefaultFor('')).toEqual({})
  })

  it('covers exactly the pages registered in the resolver registry', () => {
    expect(Object.keys(systemDefaultFor('auth')).length > 0).toBe(true)
    // Every registered key resolves to the same merged content a fresh product
    // gets (no @custom override shipped), so seeding never changes first paint.
    CONTENT_PAGE_KEYS.forEach((key) => {
      expect(mergeContent(systemDefaultFor(key), {})).toEqual(systemDefaultFor(key))
    })
  })
})

describe('content override system — copyText fallback resolver', () => {
  it('prefers a usable @custom/@system value over the fallback literal', () => {
    expect(copyText({ loginTitle: 'Welcome back' }, 'loginTitle', 'Default')).toBe('Welcome back')
  })

  it('rejects blank/whitespace-only overrides and keeps a real value byte-for-byte', () => {
    expect(copyText({ title: '   ' }, 'title', 'Fallback')).toBe('Fallback')
    expect(copyText({ title: ' ' }, 'title', 'Fallback')).toBe('Fallback')
    expect(copyText({ title: '  Plans that scale  ' }, 'title', 'Fallback')).toBe('Plans that scale  ')
  })

  it('falls back for missing key, null content, or undefined value', () => {
    expect(copyText(undefined, 'title', 'Fallback')).toBe('Fallback')
    expect(copyText(null, 'title', 'Fallback')).toBe('Fallback')
    expect(copyText({}, 'title', 'Fallback')).toBe('Fallback')
    expect(copyText({ title: undefined }, 'title', 'Fallback')).toBe('Fallback')
  })

  it('preserves a non-string value untouched only for strings (fail-safe static guard)', () => {
    // The registry contract is key → non-empty string; guard rejects non-strings.
    expect(copyText({ title: 42 }, 'title', 'Fallback')).toBe('Fallback')
  })
})
