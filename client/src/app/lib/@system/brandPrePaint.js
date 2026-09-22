// @system — Pre-paint brand + theme bootstrapping (called from main.jsx before
// ReactDOM.createRoot so the first frame is already on-brand and on-theme).
//
// 1. applyDefaultTheme(info)
//    Resolves the theme the user should see: localStorage['app-theme'] if set,
//    else info.defaultTheme (from @custom/info.js ← brand.json), with 'system'
//    resolved through prefers-color-scheme. Writes <html data-theme> + .dark via
//    lib/@system/themeDom (same contract ThemeProvider uses afterwards) and
//    persists the preference on first visit.
//
// 2. applyBrandColors(info)
//    Injects a #brand-vars <style> that overrides the colour tokens derived
//    from info.brandColor / info.accentColor in ALL theme scopes (:root,
//    [data-theme="dark"], .dark) and syncs <meta name="theme-color">. The
//    generated brand.css already carries the same values for a product whose
//    brand.json and @custom/info.js agree; this runtime layer guarantees the
//    identity a product configured in @custom/info.js wins even when brand.css
//    was not regenerated.
//
// Both functions are pure DOM side effects and are covered by jsdom contract
// tests (src/test/@system/brand-paint.test.jsx, theme-contract.test.jsx).

import { hexToHsl } from '@/app/lib/@system/utils'
import {
  VALID_THEMES,
  readStoredTheme,
  writeStoredTheme,
  resolveTheme,
  applyResolvedTheme,
} from '@/app/lib/@system/themeDom'

const WHITE_HSL = '0 0% 100%'
const INK_HSL = '240 10% 3.9%'

/** WCAG relative luminance of a #rrggbb colour (null for invalid input). */
function luminance(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
  if (!m) return null
  const [r, g, b] = [m[1], m[2], m[3]].map((c) => {
    const v = parseInt(c, 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** HSL string for readable text on `bgHex` (white on dark brands, ink on light). */
export function foregroundFor(bgHex) {
  const l = luminance(bgHex)
  if (l === null) return WHITE_HSL
  const contrastWhite = 1.05 / (l + 0.05)
  const contrastInk = (l + 0.05) / 0.05
  return contrastWhite >= contrastInk ? WHITE_HSL : INK_HSL
}

/**
 * Inject brand colour overrides for every theme scope and sync theme-color.
 * Idempotent: re-running replaces the previous #brand-vars block.
 */
export function applyBrandColors(info) {
  if (typeof document === 'undefined' || !info) return

  const vars = []
  if (info.brandColor) {
    vars.push(`--brand-panel-bg: ${info.brandColor}`)
    vars.push(`--brand-primary: ${info.brandColor}`)
    const hsl = hexToHsl(info.brandColor)
    if (hsl) {
      vars.push(`--primary: ${hsl}`)
      vars.push(`--ring: ${hsl}`)
      vars.push(`--primary-foreground: ${foregroundFor(info.brandColor)}`)
    }
  }
  if (info.accentColor) {
    vars.push(`--brand-panel-accent: ${info.accentColor}`)
    vars.push(`--brand-accent: ${info.accentColor}`)
  }

  if (vars.length) {
    const body = vars.join('; ')
    const el = document.getElementById('brand-vars') || document.createElement('style')
    el.id = 'brand-vars'
    el.textContent = [
      `:root { ${body} }`,
      `[data-theme="dark"] { ${body} }`,
      `.dark { ${body} }`,
    ].join(' ')
    if (!el.parentNode) document.head.appendChild(el)
  }

  if (info.brandColor) {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', info.brandColor)
  }
}

/**
 * Apply the initial theme before first paint and persist it on first visit.
 * Returns the resolved theme ('light' | 'dark').
 */
export function applyDefaultTheme(info) {
  const fallback = VALID_THEMES.includes(info?.defaultTheme) ? info.defaultTheme : 'light'
  const stored = readStoredTheme()
  const preference = stored ?? fallback
  if (!stored) writeStoredTheme(preference)

  const resolved = resolveTheme(preference)
  applyResolvedTheme(resolved)
  return resolved
}
