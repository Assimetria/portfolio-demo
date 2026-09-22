// @system — Pre-paint contract test for the @custom override chain
// task #1024401 criterion #3: by the time the first React paint happens the
// @custom brand identity (brandColor / accentColor / defaultTheme from
// @custom/info.js) must already be reflected in the DOM:
//   - a #brand-vars <style> holds `:root { --brand-panel-bg / --primary /
//     --ring ... }` plus `[data-theme="dark"]` and legacy `.dark` cascades built
//     from info.brandColor,
//   - the theme-color <meta> is synced to info.brandColor,
//   - <html data-theme> is set and no `.dark` class remains when the default
//     theme is light (no flash).
//
// It exercises the real functions main.jsx delegates to
// (client/src/app/lib/@system/brandPrePaint) against the real resolved `info`,
// so any drift between @custom/info.js, the resolver, and main.jsx gets caught.
import { describe, it, expect, beforeEach } from 'vitest'
import { info } from '@/config'
import { applyBrandColors, applyDefaultTheme } from '@/app/lib/@system/brandPrePaint'

beforeEach(() => {
  // Fresh, minimal DOM for the pre-paint IIFEs.
  document.head.innerHTML = ''
  const meta = document.createElement('meta')
  meta.setAttribute('name', 'theme-color')
  document.head.appendChild(meta)
  document.documentElement.classList.remove('dark')
  document.documentElement.classList.add('dark') // simulate a stale stored theme
  localStorage.clear()
})

describe('pre-paint brand/theme injection from @custom identity (main.jsx contract)', () => {
  it('injects a #brand-vars style with :root vars derived from info.brandColor/accentColor', () => {
    applyBrandColors(info)

    const style = document.getElementById('brand-vars')
    expect(style).not.toBeNull()
    expect(style.textContent).toContain(`:root { --brand-panel-bg: ${info.brandColor}`)
    expect(style.textContent).toContain('--primary:')
    expect(style.textContent).toContain('--ring:')
    expect(style.textContent).toContain(`--brand-panel-accent: ${info.accentColor}`)
  })

  it('also cascades the vars under the [data-theme="dark"] and legacy .dark scopes', () => {
    applyBrandColors(info)

    const style = document.getElementById('brand-vars')
    expect(style.textContent).toContain(`[data-theme="dark"] { --brand-panel-bg: ${info.brandColor}`)
    expect(style.textContent).toContain(`.dark { --brand-panel-bg: ${info.brandColor}`)
    // readable text on the brand colour is derived (white or ink), never hardcoded
    expect(style.textContent).toMatch(/--primary-foreground: (0 0% 100%|240 10% 3\.9%)/)
    expect(style.textContent).toContain(`--brand-primary: ${info.brandColor}`)
  })

  it('syncs the theme-color meta tag to the @custom brand color', () => {
    const meta = document.querySelector('meta[name="theme-color"]')
    expect(meta).not.toBeNull()

    applyBrandColors(info)

    expect(meta.getAttribute('content')).toBe(info.brandColor)
  })

  it('removes the stale .dark class when the default theme is light (no flash)', () => {
    applyDefaultTheme(info)

    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('persists the resolved default theme before first paint', () => {
    applyDefaultTheme(info)

    expect(localStorage.getItem('app-theme')).toBe(info.defaultTheme || 'light')
  })

  it('reads a resolvable @custom brand identity source (non-empty, valid style input)', () => {
    expect(typeof info.brandColor).toBe('string')
    expect(info.brandColor.length).toBeGreaterThan(0)
    expect(typeof info.accentColor).toBe('string')
    expect(info.accentColor.length).toBeGreaterThan(0)
    expect(['light', 'dark', 'system']).toContain(info.defaultTheme)
  })
})
