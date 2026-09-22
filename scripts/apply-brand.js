#!/usr/bin/env node
/**
 * apply-brand.js — brand.json → generated client brand artifacts
 *
 * Runs on every build via scripts/prebuild.js (Docker: `node scripts/prebuild.js`
 * then `cd client && npm run build`). brand.json at the repo root is the ONLY
 * source of product identity; everything below is derived from it.
 *
 * INPUT — brand.json. Canonical camelCase shape (what Orkosi provisioning writes):
 *   companyName, slug, tagline, description
 *   primaryColor, accentColor                      #rrggbb
 *   brandFonts: { heading, body, mono }            Google Fonts family names
 *   headingFont / bodyFont / monoFont              flat fallbacks for the same
 *   defaultTheme                                   'light' | 'dark' (default light)
 *   logoPath, svgLogoPath, faviconPath, assets.*   paths under assets/ (served at /assets/…)
 *   spacing                                        compact|comfortable|spacious or 0.75–1.5 → --space-* scale
 *   radius                                         none|sm|md|lg|xl|full or CSS length → --radius, --radius-xs…lg (alias borderRadius)
 *   modes.{light,dark}                             full palettes from the Orkosi brand engine; override the derived theme
 *   supportEmail, url, pricing, customCssVars      optional pass-through
 * brand.json is validated by scripts/lib/brand-schema.cjs (JSON-Schema mirror: brand.schema.json);
 * type errors FAIL the build. `node scripts/apply-brand.js --check` validates without writing.
 * Legacy KickOff shape is still accepted: { name, colors: { primary, accent, background,
 * surface, text, textSecondary }, theme, typography: { heading, body, mono }, logo: { url, favicon } }.
 *
 * FONT PRECEDENCE (scripts/lib/brand-fonts.cjs — shared with client/webpack.config.mjs so
 * the Google Fonts <link> in index.html and the CSS variables can never disagree):
 *   brandFonts.* → typography.* → headingFont/bodyFont/monoFont → Inter / Inter / JetBrains Mono
 *
 * OUTPUT (deterministic: same brand.json ⇒ byte-identical files, so `git status` stays clean):
 *   client/src/app/styles/@custom/brand.css
 *       shadcn semantic tokens + --brand-* palette + --font-heading/--font-body/--font-mono +
 *       semantic status colours for :root, [data-theme="dark"] and [data-theme="light"].
 *       Everything after the `@apply-brand:end` sentinel is hand-written and preserved.
 *   client/src/config/@custom/info.js
 *       export const customInfo = { name, tagline, description, logo*, favicon, defaultTheme,
 *         brandColor, accentColor, brandFonts, [supportEmail], [url], [pricing], auth }
 *       export const info = { ...baseInfo, ...customInfo }   // legacy importers
 *       client/src/config/index.js reads the module namespace and accepts either export.
 *   client/src/app/content/@generated/site.brand.js
 *       export default { locale, nav, contact, footer, seo, analytics }  — the informational
 *       site content derived from brand.json `site` (scripts/lib/site-brand.cjs). Layer 2 of
 *       the three content layers merged by client/src/config/index.js:
 *       content/@system/site.js ← THIS ← content/@custom/site.js. Always regenerated, always
 *       tracked (like @custom/info.js) so `npm test` works without a prebuild. Emitted as
 *       `export default {}` when brand.json has no `site` key.
 *
 * REGENERATION CONTRACT for @custom/info.js:
 *   - It is GENERATED and overwritten on every prebuild. Do not hand-edit it: put copy in
 *     client/src/config/@custom/text, page copy in client/src/app/content/@custom, styles in
 *     client/src/app/styles/@custom/general.css, and identity/colours/fonts in brand.json.
 *   - Escape hatch: if the first 10 lines of a hand-written file (one without the
 *     GENERATED marker) contain a comment with `apply-brand: keep`, the file is left
 *     untouched and a notice is printed.
 *
 * NO LONGER GENERATED (removed 2026-09-20, nothing imported them): client/src/config/brand.js,
 * client/src/config/design.js, root brand.js. Pricing plans from brand.json reach the app
 * through `info.pricing`.
 *
 * Usage:
 *   node scripts/apply-brand.js [--root <repo-dir>]
 *   const { applyBrand } = require('./scripts/apply-brand'); applyBrand({ root })
 */

const fs = require('fs')
const path = require('path')
const { resolveBrandFonts, fontStack } = require('./lib/brand-fonts.cjs')
const { validateBrand, formatErrors, resolveSpacingScale, resolveRadius } = require('./lib/brand-schema.cjs')
const { generateSiteBrandModule, validateBrandSite, SITE_GENERATED_MARKER } = require('./lib/site-brand.cjs')

// ─── Colour utilities ────────────────────────────────────────────────────────

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

function isHex(v) {
  return typeof v === 'string' && HEX_RE.test(v.trim())
}

/** Parse hex (#RRGGBB or #RGB) → { r, g, b } in 0-255 */
function hexToRgb(hex) {
  hex = hex.trim().replace(/^#/, '')
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  const n = parseInt(hex, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** { r, g, b } → #rrggbb */
function rgbToHex({ r, g, b }) {
  return (
    '#' +
    [r, g, b]
      .map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0'))
      .join('')
  )
}

/** { r, g, b } (0-255) → { h, s, l } (h: 0-360, s/l: 0-100) */
function rgbToHsl({ r, g, b }) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return { h: Math.round(h * 3600) / 10, s: Math.round(s * 1000) / 10, l: Math.round(l * 1000) / 10 }
}

/** { h, s, l } → { r, g, b } */
function hslToRgb({ h, s, l }) {
  h /= 360
  s /= 100
  l /= 100
  if (s === 0) {
    const v = Math.round(l * 255)
    return { r: v, g: v, b: v }
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  }
}

/** Hex → HSL CSS string for shadcn: "142.1 76.2% 36.3%" */
function hexToHslString(hex) {
  const { h, s, l } = rgbToHsl(hexToRgb(hex))
  return `${h} ${s}% ${l}%`
}

function darken(hex, amount) {
  const hsl = rgbToHsl(hexToRgb(hex))
  hsl.l = Math.max(0, hsl.l - amount)
  return rgbToHex(hslToRgb(hsl))
}

function lighten(hex, amount) {
  const hsl = rgbToHsl(hexToRgb(hex))
  hsl.l = Math.min(100, hsl.l + amount)
  return rgbToHex(hslToRgb(hsl))
}

function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Relative luminance (WCAG 2.1) */
function luminance(hex) {
  const { r, g, b } = hexToRgb(hex)
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c /= 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

function contrastRatio(hex1, hex2) {
  const l1 = luminance(hex1)
  const l2 = luminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/** Auto-pick foreground (white or near-black) for best contrast on a background */
function autoForeground(bgHex) {
  return contrastRatio(bgHex, '#ffffff') >= contrastRatio(bgHex, '#09090b') ? '#ffffff' : '#09090b'
}

// ─── Semantic status colours (same in both themes; only the tint differs) ─────

const STATUS = {
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
}

function statusBackgrounds(alpha) {
  return Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, withAlpha(v, alpha)]))
}

// ─── Spacing / radius scales ─────────────────────────────────────────────────

const SPACE_BASE_PX = Object.freeze({ xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48, '3xl': 64 })

/** brand.json `spacing` factor → { xs: '4px', … } (factor 1 = the historical defaults). */
function deriveSpacingScale(factor = 1) {
  return Object.fromEntries(Object.entries(SPACE_BASE_PX).map(([k, v]) => [k, `${Math.round(v * factor)}px`]))
}

function cssLengthToPx(value) {
  const m = /^(\d*\.?\d+)(px|rem|em)$/.exec(String(value).trim())
  if (!m) return 8
  const n = parseFloat(m[1])
  return m[2] === 'px' ? n : n * 16
}

/** `--radius` → { xs, sm, md, lg } (0.5rem = 8px gives the historical 3/6/8/12px). */
function deriveRadiusScale(radius) {
  const px = cssLengthToPx(radius)
  if (px >= 999) return { xs: '9999px', sm: '9999px', md: '9999px', lg: '9999px' }
  const r = (f) => `${Math.round(px * f)}px`
  return { xs: r(0.375), sm: r(0.75), md: r(1), lg: r(1.5) }
}

// ─── Theme derivation ────────────────────────────────────────────────────────

function primaryAccentDerivatives(primary, accent, alphas) {
  return {
    primary,
    primaryHover: darken(primary, 8),
    primaryActive: darken(primary, 14),
    primary5: withAlpha(primary, alphas[0]),
    primary10: withAlpha(primary, alphas[1]),
    primary20: withAlpha(primary, alphas[2]),
    accent,
    accentHover: darken(accent, 8),
    accentActive: darken(accent, 14),
    accent5: withAlpha(accent, alphas[0]),
    accent10: withAlpha(accent, alphas[1]),
    accent20: withAlpha(accent, alphas[2]),
    textOnPrimary: autoForeground(primary),
    textOnAccent: autoForeground(accent),
  }
}

/**
 * Dark palette. Surface hierarchy bg → surface → elevated → active (Stripe /
 * Material pattern); borders ~8/14/22% white; text 97/63/44/28% brightness.
 */
function deriveDarkTheme(basePrimary, baseAccent, overrides = {}) {
  const primary = overrides.primaryColor || basePrimary
  const accent = overrides.accentColor || baseAccent
  const bg = overrides.backgroundColor || '#09090b'
  const surface = overrides.surfaceColor || '#18181b'
  const text = overrides.textColor || '#fafafa'
  const textSecondary = overrides.textSecondaryColor || '#a1a1aa'
  const border = overrides.borderColor || '#27272a'
  const textOnPrimary = overrides.textOnPrimaryColor || autoForeground(primary)
  return {
    bg,
    surface,
    surfaceHover: overrides.surfaceHoverColor || '#27272a',
    surfaceActive: '#3f3f46',
    border,
    borderSubtle: '#1e1e22',
    borderStrong: '#3f3f46',
    text,
    textSecondary,
    textMuted: overrides.textMutedColor || '#71717a',
    textDisabled: '#52525b',
    ...primaryAccentDerivatives(primary, accent, [0.05, 0.1, 0.2]),
    ...(overrides.primaryHoverColor ? { primaryHover: overrides.primaryHoverColor } : {}),
    textOnPrimary,
    statusBg: statusBackgrounds(0.18),
    shadcn: {
      background: hexToHslString(bg),
      foreground: hexToHslString(text),
      card: hexToHslString(surface),
      cardForeground: hexToHslString(text),
      popover: hexToHslString(lighten(surface, 3)),
      popoverForeground: hexToHslString(text),
      primary: hexToHslString(primary),
      primaryForeground: hexToHslString(textOnPrimary),
      secondary: hexToHslString('#27272a'),
      secondaryForeground: hexToHslString(text),
      muted: hexToHslString('#27272a'),
      mutedForeground: hexToHslString(textSecondary),
      accent: hexToHslString('#27272a'),
      accentForeground: hexToHslString(text),
      destructive: '0 62.8% 30.6%',
      destructiveForeground: hexToHslString(text),
      border: hexToHslString(border),
      input: hexToHslString(border),
      ring: hexToHslString(primary),
    },
    shadowSm: `0 1px 2px ${withAlpha('#000000', 0.4)}, 0 0 1px ${withAlpha(primary, 0.05)}`,
    shadowMd: `0 4px 6px -1px ${withAlpha('#000000', 0.4)}, 0 2px 4px -2px ${withAlpha('#000000', 0.3)}`,
    shadowLg: `0 10px 15px -3px ${withAlpha('#000000', 0.5)}, 0 4px 6px -4px ${withAlpha('#000000', 0.3)}`,
    shadowXl: `0 20px 25px -5px ${withAlpha('#000000', 0.5)}, 0 8px 10px -6px ${withAlpha('#000000', 0.3)}`,
    shadowGlow: `0 0 20px ${withAlpha(primary, 0.15)}`,
    shadowCard: `0 2px 8px ${withAlpha('#000000', 0.25)}, 0 0 1px ${withAlpha(primary, 0.04)}`,
  }
}

/** Light palette. */
function deriveLightTheme(basePrimary, baseAccent, overrides = {}) {
  const primary = overrides.primaryColor || basePrimary
  const accent = overrides.accentColor || baseAccent
  const bg = overrides.backgroundColor || '#ffffff'
  const surface = overrides.surfaceColor || '#ffffff'
  const text = overrides.textColor || '#18181b'
  // shadcn foreground stays near-black unless the brand supplies its own text colour
  const foreground = overrides.textColor || '#09090b'
  const border = overrides.borderColor || '#e4e4e7'
  const textOnPrimary = overrides.textOnPrimaryColor || autoForeground(primary)
  return {
    bg,
    surface,
    surfaceHover: overrides.surfaceHoverColor || '#f4f4f5',
    surfaceActive: '#e4e4e7',
    border,
    borderSubtle: '#f4f4f5',
    borderStrong: '#d4d4d8',
    text,
    textSecondary: overrides.textSecondaryColor || '#52525b',
    textMuted: overrides.textMutedColor || '#a1a1aa',
    textDisabled: '#d4d4d8',
    ...primaryAccentDerivatives(primary, accent, [0.04, 0.08, 0.14]),
    ...(overrides.primaryHoverColor ? { primaryHover: overrides.primaryHoverColor } : {}),
    textOnPrimary,
    statusBg: statusBackgrounds(0.1),
    shadcn: {
      background: hexToHslString(bg),
      foreground: hexToHslString(foreground),
      card: hexToHslString(surface),
      cardForeground: hexToHslString(foreground),
      popover: hexToHslString(bg),
      popoverForeground: hexToHslString(foreground),
      primary: hexToHslString(primary),
      primaryForeground: hexToHslString(textOnPrimary),
      secondary: hexToHslString('#f4f4f5'),
      secondaryForeground: hexToHslString(text),
      muted: hexToHslString('#f4f4f5'),
      mutedForeground: hexToHslString(overrides.textSecondaryColor || '#71717a'),
      accent: hexToHslString('#f4f4f5'),
      accentForeground: hexToHslString(text),
      destructive: '0 84.2% 60.2%',
      destructiveForeground: '0 0% 100%',
      border: hexToHslString(border),
      input: hexToHslString(border),
      ring: hexToHslString(primary),
    },
    shadowSm: `0 1px 2px ${withAlpha('#000000', 0.05)}`,
    shadowMd: `0 4px 6px -1px ${withAlpha('#000000', 0.1)}, 0 2px 4px -2px ${withAlpha('#000000', 0.06)}`,
    shadowLg: `0 10px 15px -3px ${withAlpha('#000000', 0.1)}, 0 4px 6px -4px ${withAlpha('#000000', 0.06)}`,
    shadowXl: `0 20px 25px -5px ${withAlpha('#000000', 0.1)}, 0 8px 10px -6px ${withAlpha('#000000', 0.06)}`,
    shadowGlow: `0 0 20px ${withAlpha(primary, 0.08)}`,
    shadowCard: `0 2px 8px ${withAlpha('#000000', 0.08)}`,
  }
}

// ─── CSS generation ──────────────────────────────────────────────────────────

const CSS_END_SENTINEL =
  '/* @apply-brand:end — generated tokens above; hand-written CSS below this line is preserved on regeneration */'

function shadcnBlock(s, indent = '  ') {
  return [
    ['background', s.background],
    ['foreground', s.foreground],
    ['card', s.card],
    ['card-foreground', s.cardForeground],
    ['popover', s.popover],
    ['popover-foreground', s.popoverForeground],
    ['primary', s.primary],
    ['primary-foreground', s.primaryForeground],
    ['secondary', s.secondary],
    ['secondary-foreground', s.secondaryForeground],
    ['muted', s.muted],
    ['muted-foreground', s.mutedForeground],
    ['accent', s.accent],
    ['accent-foreground', s.accentForeground],
    ['destructive', s.destructive],
    ['destructive-foreground', s.destructiveForeground],
    ['border', s.border],
    ['input', s.input],
    ['ring', s.ring],
  ]
    .map(([k, v]) => `${indent}--${k}: ${v};`)
    .join('\n')
}

/** Tokens that differ per theme (emitted for :root, dark and light). */
function themeScopedBlock(p, indent = '  ') {
  const lines = [
    `${indent}/* Brand palette */`,
    `${indent}--brand-primary: ${p.primary};`,
    `${indent}--brand-primary-hover: ${p.primaryHover};`,
    `${indent}--brand-primary-active: ${p.primaryActive};`,
    `${indent}--brand-primary-5: ${p.primary5};`,
    `${indent}--brand-primary-10: ${p.primary10};`,
    `${indent}--brand-primary-20: ${p.primary20};`,
    `${indent}--brand-accent: ${p.accent};`,
    `${indent}--brand-accent-hover: ${p.accentHover};`,
    `${indent}--brand-accent-active: ${p.accentActive};`,
    `${indent}--brand-accent-5: ${p.accent5};`,
    `${indent}--brand-accent-10: ${p.accent10};`,
    `${indent}--brand-accent-20: ${p.accent20};`,
    '',
    `${indent}/* Surface hierarchy (Level 0→3) */`,
    `${indent}--brand-bg: ${p.bg};`,
    `${indent}--brand-surface: ${p.surface};`,
    `${indent}--brand-surface-hover: ${p.surfaceHover};`,
    `${indent}--brand-surface-active: ${p.surfaceActive};`,
    `${indent}--brand-panel-bg: ${p.primary};`,
    `${indent}--brand-panel-accent: ${p.accent};`,
    `${indent}--brand-panel-text: ${p.textOnPrimary};`,
    `${indent}--brand-panel-muted: ${withAlpha(p.textOnPrimary, 0.72)};`,
    '',
    `${indent}/* Border hierarchy (subtle → default → strong) */`,
    `${indent}--brand-border-subtle: ${p.borderSubtle};`,
    `${indent}--brand-border: ${p.border};`,
    `${indent}--brand-border-strong: ${p.borderStrong};`,
    '',
    `${indent}/* Text hierarchy */`,
    `${indent}--brand-text: ${p.text};`,
    `${indent}--brand-text-secondary: ${p.textSecondary};`,
    `${indent}--brand-text-muted: ${p.textMuted};`,
    `${indent}--brand-text-disabled: ${p.textDisabled};`,
    `${indent}--brand-text-on-primary: ${p.textOnPrimary};`,
    `${indent}--brand-text-on-accent: ${p.textOnAccent};`,
    '',
    `${indent}/* Semantic status colours + tinted backgrounds */`,
    `${indent}--color-success: ${STATUS.success};`,
    `${indent}--color-error: ${STATUS.error};`,
    `${indent}--color-warning: ${STATUS.warning};`,
    `${indent}--color-info: ${STATUS.info};`,
    `${indent}--color-success-bg: ${p.statusBg.success};`,
    `${indent}--color-error-bg: ${p.statusBg.error};`,
    `${indent}--color-warning-bg: ${p.statusBg.warning};`,
    `${indent}--color-info-bg: ${p.statusBg.info};`,
    '',
    `${indent}/* Shadows */`,
    `${indent}--shadow-sm: ${p.shadowSm};`,
    `${indent}--shadow-md: ${p.shadowMd};`,
    `${indent}--shadow-lg: ${p.shadowLg};`,
    `${indent}--shadow-xl: ${p.shadowXl};`,
    `${indent}--shadow-glow-primary: ${p.shadowGlow};`,
    `${indent}--shadow-card: ${p.shadowCard};`,
  ]
  return lines.join('\n')
}

function generateBrandCss(brand, dark, light, fonts) {
  const defaultTheme = brand.defaultTheme
  const defaultPalette = defaultTheme === 'dark' ? dark : light
  const radius = brand.radius || '0.5rem'
  const radiusScale = deriveRadiusScale(radius)
  const spacingFactor = brand.spacingScale || 1
  const space = deriveSpacingScale(spacingFactor)
  const headingStack = fontStack(fonts.heading, 'sans')
  const bodyStack = fontStack(fonts.body, 'sans')
  const monoStack = fontStack(fonts.mono, 'mono')

  const customVars = brand.customCssVars && Object.keys(brand.customCssVars).length
    ? `\n  /* ── Product-specific custom vars (brand.json customCssVars) ── */\n${Object.entries(brand.customCssVars)
        .map(([k, v]) => `  ${k}: ${v};`)
        .join('\n')}\n`
    : ''

  return `/*
 * GENERATED by scripts/apply-brand.js from brand.json — DO NOT EDIT the token blocks.
 *   companyName:  ${brand.companyName}
 *   primaryColor: ${brand.primaryColor}
 *   accentColor:  ${brand.accentColor}
 *   defaultTheme: ${defaultTheme}
 *   fonts:        heading=${fonts.heading} · body=${fonts.body} · mono=${fonts.mono}
 *
 * Theme switch: <html data-theme="light|dark"> (see client/src/app/lib/@system/themeDom.js).
 * :root carries the default theme; [data-theme="dark"] / [data-theme="light"] override it.
 * Hand-written CSS belongs after the @apply-brand:end sentinel at the bottom (preserved),
 * or in client/src/app/styles/@custom/general.css.
 */

:root {
  /* ── shadcn/ui semantic tokens (${defaultTheme}-first) ── */
${shadcnBlock(defaultPalette.shadcn)}
  --radius: ${radius};
  --radius-xl: calc(${radius} * 2);

${themeScopedBlock(defaultPalette)}

  /* ── Typography (brand.json brandFonts) ── */
  --font-heading: ${headingStack};
  --font-body: ${bodyStack};
  --font-mono: ${monoStack};
  --font-primary: var(--font-heading);
  --font-secondary: var(--font-body);

  --text-2xs: 0.65rem;
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-ui: 0.938rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;

  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;

  /* ── Extended palette (charts, tags) ── */
  --color-lime: #84cc16;
  --color-yellow: #eab308;
  --color-orange: #f97316;
  --color-purple: #a855f7;
  --color-cyan: #06b6d4;

  /* ── Spacing scale (brand.json spacing: ${spacingFactor}) ── */
  --space-scale: ${spacingFactor};
  --space-xs: ${space.xs};
  --space-sm: ${space.sm};
  --space-md: ${space.md};
  --space-lg: ${space.lg};
  --space-xl: ${space.xl};
  --space-2xl: ${space['2xl']};
  --space-3xl: ${space['3xl']};

  /* ── Radius scale (brand.json radius: ${radius}) ── */
  --radius-xs: ${radiusScale.xs};
  --radius-sm: ${radiusScale.sm};
  --radius-md: ${radiusScale.md};
  --radius-lg: ${radiusScale.lg};
  --radius-full: 9999px;

  /* ── Focus rings / misc shadows ── */
  --shadow-button: 0 1px 3px rgba(0,0,0,0.3);
  --shadow-overlay: 0 4px 20px rgba(0,0,0,0.6);
  --ring-primary: 0 0 0 1px var(--brand-primary);
  --ring-accent: 0 0 0 1px var(--brand-accent);

  /* ── Transitions ── */
  --transition-fast: 120ms ease;
  --transition-normal: 200ms ease;
  --transition-base: 300ms ease;
  --transition-slow: 400ms ease;
  --transition-slower: 600ms ease;

  /* ── Z-index scale ── */
  --z-base: 0;
  --z-raised: 10;
  --z-dropdown: 200;
  --z-modal: 50;
  --z-toast: 9999;
  --z-tooltip: 50;

  /* ── Layout ── */
  --max-width: 1200px;
  --header-height: 64px;
  --sidebar-width: 240px;
  --sidebar-width-collapsed: 68px;
${customVars}}

[data-theme="dark"] {
  color-scheme: dark;
  /* shadcn/ui — dark */
${shadcnBlock(dark.shadcn)}

${themeScopedBlock(dark)}
}

[data-theme="light"] {
  color-scheme: light;
  /* shadcn/ui — light */
${shadcnBlock(light.shadcn)}

${themeScopedBlock(light)}
}

${CSS_END_SENTINEL}
`
}

// ─── brand.json normalisation ────────────────────────────────────────────────

const DEFAULT_PRIMARY = '#64748B'
const DEFAULT_ACCENT = '#94A3B8'

function pickColor(candidates, fallback, label, warn) {
  for (const c of candidates) {
    if (isHex(c)) return c.trim()
    if (c !== undefined && c !== null && c !== '' && warn) warn(`ignoring invalid ${label} "${c}" — expected #rrggbb`)
  }
  return fallback
}

function toPublicPath(p) {
  if (typeof p !== 'string' || !p.trim()) return ''
  const s = p.trim()
  if (/^(https?:)?\/\//.test(s) || s.startsWith('data:')) return s
  return '/' + s.replace(/^\.?\/+/, '')
}

/**
 * Map one `modes.<theme>` block from the Orkosi brand engine (contrast-checked
 * palette: primary, accent, bg, surface, surfaceRaised, text, textMuted,
 * textFaint, border, primaryHover, onPrimary, …) to the override keys the
 * derive*Theme functions understand. Non-hex values are ignored.
 */
function modeOverrides(mode) {
  if (!mode || typeof mode !== 'object') return {}
  const pick = (v) => (isHex(v) ? v.trim() : undefined)
  const mapped = {
    primaryColor: pick(mode.primary),
    accentColor: pick(mode.accent),
    backgroundColor: pick(mode.bg),
    surfaceColor: pick(mode.surface),
    surfaceHoverColor: pick(mode.surfaceRaised),
    textColor: pick(mode.text),
    textSecondaryColor: pick(mode.textMuted),
    textMutedColor: pick(mode.textFaint),
    borderColor: pick(mode.border),
    primaryHoverColor: pick(mode.primaryHover),
    textOnPrimaryColor: pick(mode.onPrimary),
  }
  return Object.fromEntries(Object.entries(mapped).filter(([, v]) => v))
}

function resolveModes(modes) {
  const m = modes && typeof modes === 'object' ? modes : {}
  return { light: modeOverrides(m.light), dark: modeOverrides(m.dark) }
}

/**
 * Normalise a raw brand.json (canonical camelCase OR legacy grouped) into the
 * flat object every generator below consumes.
 */
function resolveBrand(raw = {}, { warn } = {}) {
  const colors = raw.colors || {}
  const assets = raw.assets || {}
  const assetPath = (file) => (file ? toPublicPath(`assets/logos/${file}`) : '')

  const logoMark = toPublicPath(raw.svgLogoPath) || assetPath(assets.logoMark) || toPublicPath(raw.logo?.url) || toPublicPath(raw.logoUrl)
  const logoFull = toPublicPath(raw.logoPath) || assetPath(assets.logoSvg || assets.logo) || logoMark
  const logoOnDark = assetPath(assets.logoOnDark || assets.logoWhite || assets.logoDark)
  const favicon = toPublicPath(raw.faviconPath) || toPublicPath(raw.logo?.favicon) || toPublicPath(raw.faviconUrl) || '/favicon.svg'

  const themeRaw = raw.defaultTheme || raw.theme
  const defaultTheme = themeRaw === 'dark' ? 'dark' : 'light'
  if (themeRaw && themeRaw !== 'dark' && themeRaw !== 'light' && warn) {
    warn(`defaultTheme "${themeRaw}" is not light|dark — using light`)
  }

  return {
    companyName: String(raw.companyName || raw.name || 'Product').trim(),
    slug: raw.slug || '',
    tagline: typeof raw.tagline === 'string' ? raw.tagline : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    url: typeof raw.url === 'string' ? raw.url : '',
    supportEmail: typeof raw.supportEmail === 'string' ? raw.supportEmail : '',
    primaryColor: pickColor([raw.primaryColor, colors.primary, raw.brand_color], DEFAULT_PRIMARY, 'primaryColor', warn),
    accentColor: pickColor([raw.accentColor, colors.accent, raw.accent_color], DEFAULT_ACCENT, 'accentColor', warn),
    backgroundColor: isHex(colors.background) ? colors.background : isHex(raw.backgroundColor) ? raw.backgroundColor : undefined,
    surfaceColor: isHex(colors.surface) ? colors.surface : isHex(raw.surfaceColor) ? raw.surfaceColor : undefined,
    textColor: isHex(colors.text) ? colors.text : isHex(raw.textColor) ? raw.textColor : undefined,
    textSecondaryColor: isHex(colors.textSecondary) ? colors.textSecondary : isHex(raw.textSecondaryColor) ? raw.textSecondaryColor : undefined,
    defaultTheme,
    logoMark: logoMark || '/assets/logos/logo-mark.svg',
    logoFull: logoFull || '/assets/logos/logo.svg',
    logoOnDark: logoOnDark || logoFull || logoMark || '/assets/logos/logo-white.svg',
    favicon,
    pricing: raw.pricing && typeof raw.pricing === 'object' ? raw.pricing : null,
    customCssVars: raw.customCssVars && typeof raw.customCssVars === 'object' ? raw.customCssVars : {},
    borderRadius: typeof raw.borderRadius === 'string' ? raw.borderRadius : '',
    radius: resolveRadius(raw.radius, raw.borderRadius),
    spacingScale: resolveSpacingScale(raw.spacing),
    modes: resolveModes(raw.modes),
    // Informational site content block (see scripts/lib/site-brand.cjs for the schema).
    site: raw.site && typeof raw.site === 'object' && !Array.isArray(raw.site) ? raw.site : {},
  }
}

// ─── @custom/info.js generation ──────────────────────────────────────────────

const INFO_GENERATED_MARKER = 'GENERATED by scripts/apply-brand.js'
// Opt-out: a comment line in the first 10 lines containing `apply-brand: keep`.
// A file that carries INFO_GENERATED_MARKER is ours and is always regenerated,
// even though its header *mentions* the opt-out — a generated file cannot opt out.
const INFO_KEEP_MARKER = /^\s*\/\/.*apply-brand:\s*keep\b/im

function js(value) {
  return JSON.stringify(value)
}

function generateCustomInfo(brand, fonts) {
  const optional = []
  if (brand.supportEmail) optional.push(`  supportEmail: ${js(brand.supportEmail)},`)
  if (brand.url) optional.push(`  url: ${js(brand.url)},`)
  if (brand.pricing) {
    const pretty = JSON.stringify(brand.pricing, null, 2).replace(/\n/g, '\n  ')
    optional.push(`  pricing: ${pretty},`)
  }

  return `// @custom — product identity for ${brand.companyName}
// ${INFO_GENERATED_MARKER} from the repo-root brand.json — DO NOT EDIT BY HAND.
//
// Regenerated on every prebuild (scripts/prebuild.js → apply-brand.js). Change
// identity, colours, fonts and theme in brand.json; put copy in
// config/@custom/text and content/@custom; put styles in styles/@custom/general.css.
// To stop regeneration for a bespoke file put a comment line reading
//   // apply-brand: keep
// within the first 10 lines.
//
// Consumed by client/src/config/index.js as { ...systemInfo, ...customInfo }.
// The legacy \`info\` export is kept for older importers.

import { info as baseInfo } from "../@system/info";

export const customInfo = {
  name: ${js(brand.companyName)},
  tagline: ${js(brand.tagline)},
  description: ${js(brand.description || 'a software-as-a-service platform')},
  // Logo paths are served from /assets/logos (webpack copies assets/logos there).
  logo: ${js(brand.logoMark)},
  logoUrl: ${js(brand.logoFull)},
  logoDark: ${js(brand.logoOnDark)},
  logoWhite: ${js(brand.logoOnDark)},
  favicon: ${js(brand.favicon)},
  defaultTheme: ${js(brand.defaultTheme)},
  brandColor: ${js(brand.primaryColor)},
  accentColor: ${js(brand.accentColor)},
  brandFonts: {
    heading: ${js(fonts.heading)},
    body: ${js(fonts.body)},
    mono: ${js(fonts.mono)},
  },
${optional.length ? optional.join('\n') + '\n' : ''}  auth: {
    ...baseInfo.auth,
    // Never ship fabricated social proof — products add real quotes in @custom/text.
    testimonial: null,
  },
};

export const info = { ...baseInfo, ...customInfo };
`
}

const SITE_BRAND_REL = 'client/src/app/content/@generated/site.brand.js'

// ─── File helpers ────────────────────────────────────────────────────────────

function writeIfChanged(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return false
  fs.writeFileSync(file, content, 'utf8')
  return true
}

/** Hand-written CSS after the sentinel (or, for pre-sentinel files, after the light block). */
function extractHandWrittenCss(existing) {
  if (!existing) return ''
  const idx = existing.indexOf(CSS_END_SENTINEL)
  if (idx !== -1) return existing.slice(idx + CSS_END_SENTINEL.length).replace(/^\s*\n/, '')
  const lightBlock = existing.match(/\[data-theme="light"\]\s*\{[^}]*\}/)
  if (lightBlock) {
    return existing.slice(existing.indexOf(lightBlock[0]) + lightBlock[0].length).replace(/^\s*\n/, '')
  }
  return ''
}

// ─── Main entry ──────────────────────────────────────────────────────────────

/**
 * Apply brand.json under `root`. Returns { brand, fonts, written: [relative paths] }.
 */
function applyBrand({ root = path.resolve(__dirname, '..'), log = console.log, warn = console.warn } = {}) {
  const brandJsonPath = path.join(root, 'brand.json')
  if (!fs.existsSync(brandJsonPath)) {
    throw new Error(`brand.json not found at ${brandJsonPath}`)
  }
  const raw = JSON.parse(fs.readFileSync(brandJsonPath, 'utf8'))
  const { errors, warnings } = validateBrand(raw)
  for (const w of warnings) warn(`[apply-brand] ${w}`)
  if (errors.length) {
    throw new Error(`brand.json is invalid (${errors.length} error${errors.length === 1 ? '' : 's'}):\n  ${formatErrors(errors)}`)
  }
  const brand = resolveBrand(raw, { warn: (m) => warn(`[apply-brand] ${m}`) })
  const fonts = resolveBrandFonts(raw)

  // Top-level colour overrides apply to both themes (legacy); modes.<theme> from the
  // brand engine wins for its theme.
  const dark = deriveDarkTheme(brand.primaryColor, brand.accentColor, { ...brand, ...brand.modes.dark })
  const light = deriveLightTheme(brand.primaryColor, brand.accentColor, { ...brand, ...brand.modes.light })

  const written = []
  const rel = (p) => path.relative(root, p)

  // 1. brand.css — regenerate tokens, keep hand-written tail
  const brandCssPath = path.join(root, 'client/src/app/styles/@custom/brand.css')
  const existingCss = fs.existsSync(brandCssPath) ? fs.readFileSync(brandCssPath, 'utf8') : ''
  const tail = extractHandWrittenCss(existingCss)
  const css = generateBrandCss(brand, dark, light, fonts) + (tail.trim() ? '\n' + tail.replace(/\s+$/, '') + '\n' : '')
  if (writeIfChanged(brandCssPath, css)) written.push(rel(brandCssPath))

  // 2. @custom/info.js — generated unless the product opted out
  const infoPath = path.join(root, 'client/src/config/@custom/info.js')
  const existingInfo = fs.existsSync(infoPath) ? fs.readFileSync(infoPath, 'utf8') : ''
  const head = existingInfo.split('\n').slice(0, 10).join('\n')
  if (existingInfo && !head.includes(INFO_GENERATED_MARKER) && INFO_KEEP_MARKER.test(head)) {
    log(`[apply-brand] ${rel(infoPath)} has "apply-brand: keep" — left untouched`)
  } else if (writeIfChanged(infoPath, generateCustomInfo(brand, fonts))) {
    written.push(rel(infoPath))
  }

  // 3. content/@generated/site.brand.js — informational site content from brand.json `site`
  for (const w of validateBrandSite(brand.site)) warn(`[apply-brand] ${w}`)
  const sitePath = path.join(root, SITE_BRAND_REL)
  if (writeIfChanged(sitePath, generateSiteBrandModule(brand.site, { companyName: brand.companyName }))) {
    written.push(rel(sitePath))
  }

  const palette = brand.defaultTheme === 'dark' ? dark : light
  log(
    `[apply-brand] ${brand.companyName} · ${brand.defaultTheme} · primary ${brand.primaryColor} (text ${palette.textOnPrimary}) · accent ${brand.accentColor} · fonts ${fonts.heading}/${fonts.body}/${fonts.mono}`,
  )
  log(written.length ? `[apply-brand] wrote ${written.join(', ')}` : '[apply-brand] up to date — nothing to write')

  return { brand, fonts, written }
}

/** Validate brand.json under `root` without writing anything. Returns { errors, warnings }. */
function checkBrand({ root = path.resolve(__dirname, '..') } = {}) {
  const brandJsonPath = path.join(root, 'brand.json')
  if (!fs.existsSync(brandJsonPath)) return { errors: [{ path: '', message: `brand.json not found at ${brandJsonPath}` }], warnings: [] }
  let raw
  try {
    raw = JSON.parse(fs.readFileSync(brandJsonPath, 'utf8'))
  } catch (err) {
    return { errors: [{ path: '', message: `brand.json is not valid JSON: ${err.message}` }], warnings: [] }
  }
  return validateBrand(raw)
}

module.exports = {
  applyBrand,
  checkBrand,
  resolveBrand,
  resolveModes,
  deriveSpacingScale,
  deriveRadiusScale,
  generateBrandCss,
  generateCustomInfo,
  deriveDarkTheme,
  deriveLightTheme,
  extractHandWrittenCss,
  CSS_END_SENTINEL,
  INFO_GENERATED_MARKER,
  SITE_GENERATED_MARKER,
  SITE_BRAND_REL,
  // colour helpers (used by tests)
  hexToHslString,
  autoForeground,
  contrastRatio,
}

if (require.main === module) {
  const args = process.argv.slice(2)
  const rootIdx = args.indexOf('--root')
  const root = rootIdx !== -1 && args[rootIdx + 1] ? path.resolve(args[rootIdx + 1]) : undefined
  try {
    if (args.includes('--check')) {
      const { errors, warnings } = checkBrand(root ? { root } : {})
      for (const w of warnings) console.warn(`[apply-brand] ${w}`)
      if (errors.length) {
        console.error(`[apply-brand] brand.json is invalid (${errors.length}):\n  ${formatErrors(errors)}`)
        process.exit(1)
      }
      console.log('[apply-brand] brand.json OK')
      process.exit(0)
    }
    applyBrand(root ? { root } : {})
  } catch (err) {
    console.error(`[apply-brand] ${err.message}`)
    process.exit(1)
  }
}
