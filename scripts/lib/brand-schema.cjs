/**
 * brand-schema.cjs — validation of brand.json, the single source of product
 * identity (see brand.schema.json for the editor/JSON-Schema view of the same
 * contract, and docs/BRANDING.md for the full pipeline).
 *
 * Dependency-free on purpose: it runs inside scripts/apply-brand.js on every
 * build (Docker stage 2 has no dev dependencies). Unknown keys are allowed —
 * the Orkosi brand engine adds richer data (modes, typography.scale, voice,
 * positioning, logos[]) that rides along untouched — but every key the build
 * CONSUMES must have the right type, so a typo in a colour breaks the build
 * instead of silently falling back to grey.
 *
 * validateBrand(raw) → { errors: [{ path, message }], warnings: [string] }
 */

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i
const RGBA_RE = /^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+\s*)?\)$/i
const CSS_LENGTH_RE = /^\d*\.?\d+(px|rem|em)$/

const SPACING_PRESETS = Object.freeze({ compact: 0.875, comfortable: 1, spacious: 1.125 })
const RADIUS_PRESETS = Object.freeze({ none: '0px', sm: '0.25rem', md: '0.5rem', lg: '0.75rem', xl: '1rem', full: '9999px' })
const THEMES = Object.freeze(['light', 'dark'])

// Keys of modes.<mode> that must be hex when present (hairline is rgba by contract).
const MODE_HEX_KEYS = Object.freeze([
  'primary', 'secondary', 'accent', 'bg', 'surface', 'surfaceRaised', 'text', 'textMuted', 'textFaint',
  'border', 'primaryHover', 'primaryText', 'secondaryText', 'accentText', 'onPrimary', 'onSecondary', 'onAccent',
])

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isStr = (v) => typeof v === 'string'
const isHex = (v) => isStr(v) && HEX_RE.test(v.trim())

function validateBrand(raw) {
  const errors = []
  const warnings = []
  const err = (p, message) => errors.push({ path: p, message })
  const expectStr = (p, v) => {
    if (v !== undefined && v !== null && !isStr(v)) err(p, 'must be a string')
  }
  const expectHex = (p, v) => {
    if (v !== undefined && v !== null && v !== '' && !isHex(v)) err(p, `must be a hex colour (#rrggbb), got ${JSON.stringify(v)}`)
  }

  if (!isObj(raw)) return { errors: [{ path: '', message: 'brand.json must be a JSON object' }], warnings }

  // identity
  for (const k of ['companyName', 'name', 'slug', 'tagline', 'description', 'url', 'supportEmail', 'toneOfVoice', 'brandVoice']) {
    expectStr(k, raw[k])
  }
  if (!isStr(raw.companyName) && !isStr(raw.name)) warnings.push('companyName missing — falling back to "Product"')
  if (raw.slug !== undefined && isStr(raw.slug) && raw.slug && !/^[a-z0-9][a-z0-9-]*$/.test(raw.slug)) {
    err('slug', 'must be lowercase letters, digits and dashes')
  }

  // colours
  expectHex('primaryColor', raw.primaryColor)
  expectHex('accentColor', raw.accentColor)
  expectHex('iconColor', raw.iconColor)
  for (const k of ['backgroundColor', 'surfaceColor', 'textColor', 'textSecondaryColor']) expectHex(k, raw[k])
  if (raw.colors !== undefined) {
    if (!isObj(raw.colors)) err('colors', 'must be an object')
    else for (const [k, v] of Object.entries(raw.colors)) {
      if (k === 'semantic') continue
      if (isStr(v)) expectHex(`colors.${k}`, v)
    }
  }
  if (!isHex(raw.primaryColor) && !(isObj(raw.colors) && isHex(raw.colors.primary)) && !isHex(raw.brand_color)) {
    warnings.push('primaryColor missing — using the neutral default palette')
  }

  // fonts
  for (const k of ['headingFont', 'bodyFont', 'monoFont']) expectStr(k, raw[k])
  for (const group of ['brandFonts', 'typography']) {
    if (raw[group] === undefined) continue
    if (!isObj(raw[group])) err(group, 'must be an object')
    else for (const slot of ['heading', 'body', 'mono']) expectStr(`${group}.${slot}`, raw[group][slot])
  }

  // theme
  const theme = raw.defaultTheme ?? raw.theme
  if (theme !== undefined && theme !== null && !THEMES.includes(theme)) err('defaultTheme', `must be "light" or "dark", got ${JSON.stringify(theme)}`)
  if (raw.modes !== undefined) {
    if (!isObj(raw.modes)) err('modes', 'must be an object with light/dark')
    else for (const mode of Object.keys(raw.modes)) {
      if (!THEMES.includes(mode)) {
        warnings.push(`modes.${mode} ignored — only light/dark are used`)
        continue
      }
      const m = raw.modes[mode]
      if (!isObj(m)) {
        err(`modes.${mode}`, 'must be an object')
        continue
      }
      for (const k of MODE_HEX_KEYS) expectHex(`modes.${mode}.${k}`, m[k])
      if (m.hairline !== undefined && !(isHex(m.hairline) || (isStr(m.hairline) && RGBA_RE.test(m.hairline)))) {
        err(`modes.${mode}.hairline`, 'must be a hex or rgba() colour')
      }
      if (m.semantic !== undefined && !isObj(m.semantic)) err(`modes.${mode}.semantic`, 'must be an object')
    }
  }

  // spacing / radius
  if (raw.spacing !== undefined && raw.spacing !== null) {
    const s = raw.spacing
    const ok = (isStr(s) && s in SPACING_PRESETS) || (typeof s === 'number' && s >= 0.75 && s <= 1.5)
    if (!ok) err('spacing', `must be one of ${Object.keys(SPACING_PRESETS).join('|')} or a number between 0.75 and 1.5`)
  }
  for (const k of ['radius', 'borderRadius']) {
    const r = raw[k]
    if (r === undefined || r === null || r === '') continue
    const ok = isStr(r) && (r in RADIUS_PRESETS || CSS_LENGTH_RE.test(r.trim()))
    if (!ok) err(k, `must be one of ${Object.keys(RADIUS_PRESETS).join('|')} or a CSS length (px|rem|em)`)
  }

  // paths & assets
  for (const k of ['logoPath', 'svgLogoPath', 'faviconPath', 'thumbnailPath', 'brandGuidelinesPath', 'logoUrl', 'faviconUrl']) {
    expectStr(k, raw[k])
  }
  if (raw.assets !== undefined) {
    if (!isObj(raw.assets)) err('assets', 'must be an object mapping asset keys to file names')
    else for (const [k, v] of Object.entries(raw.assets)) if (!isStr(v)) err(`assets.${k}`, 'must be a file name string')
  }
  if (raw.logo !== undefined && !isObj(raw.logo) && !isStr(raw.logo)) err('logo', 'must be an object { url, favicon } or a string')

  // pass-through objects the build consumes
  if (raw.pricing !== undefined && raw.pricing !== null && !isObj(raw.pricing)) err('pricing', 'must be an object')
  if (raw.customCssVars !== undefined) {
    if (!isObj(raw.customCssVars)) err('customCssVars', 'must be an object')
    else for (const [k, v] of Object.entries(raw.customCssVars)) {
      if (!/^--[a-z0-9-]+$/i.test(k)) err(`customCssVars.${k}`, 'keys must be CSS custom properties (--name)')
      if (!isStr(v) && typeof v !== 'number') err(`customCssVars.${k}`, 'values must be strings or numbers')
    }
  }
  if (raw.securityHeaders !== undefined) {
    if (!isObj(raw.securityHeaders)) err('securityHeaders', 'must be an object')
    else {
      const csp = raw.securityHeaders.contentSecurityPolicy ?? raw.securityHeaders.csp
      if (csp !== undefined && !isObj(csp)) err('securityHeaders.contentSecurityPolicy', 'must be an object of directive → string[]')
      else if (isObj(csp)) for (const [d, v] of Object.entries(csp)) {
        if (!Array.isArray(v) || !v.every(isStr)) err(`securityHeaders.contentSecurityPolicy.${d}`, 'must be an array of strings')
      }
    }
  }

  return { errors, warnings }
}

/** spacing → multiplier for the --space-* scale. */
function resolveSpacingScale(spacing) {
  if (typeof spacing === 'number' && spacing >= 0.75 && spacing <= 1.5) return spacing
  if (isStr(spacing) && spacing in SPACING_PRESETS) return SPACING_PRESETS[spacing]
  return 1
}

/** radius | borderRadius → CSS length for --radius. */
function resolveRadius(radius, borderRadius) {
  for (const r of [radius, borderRadius]) {
    if (!isStr(r) || !r.trim()) continue
    const v = r.trim()
    if (v in RADIUS_PRESETS) return RADIUS_PRESETS[v]
    if (CSS_LENGTH_RE.test(v)) return v
  }
  return RADIUS_PRESETS.md
}

function formatErrors(errors) {
  return errors.map((e) => `${e.path || '(root)'}: ${e.message}`).join('\n  ')
}

module.exports = {
  validateBrand,
  formatErrors,
  resolveSpacingScale,
  resolveRadius,
  SPACING_PRESETS,
  RADIUS_PRESETS,
  MODE_HEX_KEYS,
}
