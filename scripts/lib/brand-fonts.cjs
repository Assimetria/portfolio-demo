/**
 * brand-fonts.cjs — single source of truth for "which fonts does this brand use
 * and how do we load them". Shared (CommonJS) by:
 *   - scripts/apply-brand.js       → --font-heading / --font-body / --font-mono in brand.css
 *   - client/webpack.config.mjs    → GOOGLE_FONTS_LINK / BRAND_FONT_* HtmlWebpackPlugin params
 *   - client/src/test/@system/brand-fonts.test.js (unit tests)
 *
 * Resolution order for each slot (heading | body | mono), first non-blank wins:
 *   1. brandFonts.{heading,body,mono}     — canonical (what Orkosi provisioning writes)
 *   2. typography.{heading,body,mono}     — legacy grouped format (KickOff)
 *   3. headingFont / bodyFont / monoFont  — legacy flat keys
 *   4. defaults: Inter / Inter / JetBrains Mono
 *
 * Values are Google Fonts family names ("Poppins", "Space Grotesk"). A value may
 * also be a CSS font stack ("'Inter', sans-serif") — only the first family is used.
 * Generic / system families (system-ui, sans-serif, Arial, …) are honoured in the
 * CSS stacks but never requested from Google Fonts.
 */

const DEFAULT_FONTS = Object.freeze({ heading: 'Inter', body: 'Inter', mono: 'JetBrains Mono' })
const DEFAULT_WEIGHTS = Object.freeze([400, 500, 600, 700])

// Families that ship with the OS or are CSS generics — never fetched from Google.
const NON_GOOGLE_FAMILIES = new Set(
  [
    'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded',
    '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'sans-serif', 'serif',
    'monospace', 'cursive', 'fantasy', 'math', 'emoji', 'fangsong',
    'arial', 'helvetica', 'helvetica neue', 'verdana', 'tahoma', 'trebuchet ms',
    'georgia', 'times new roman', 'times', 'garamond', 'palatino',
    'courier new', 'courier', 'menlo', 'monaco', 'consolas', 'sfmono-regular',
    'lucida console', 'lucida grande', 'inherit', 'initial',
  ].map((f) => f.toLowerCase()),
)

const SANS_FALLBACK = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
const MONO_FALLBACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

/** Normalise a raw font value to a single family name ('' when unusable). */
function cleanFamily(value) {
  if (typeof value !== 'string') return ''
  const first = value.split(',')[0] || ''
  return first.replace(/^\s*["']?|["']?\s*$/g, '').trim()
}

/** Resolve { heading, body, mono } from a raw brand.json object. */
function resolveBrandFonts(raw = {}) {
  const brandFonts = (raw && raw.brandFonts) || {}
  const typography = (raw && raw.typography) || {}
  const pick = (...candidates) => candidates.map(cleanFamily).find(Boolean) || ''
  return {
    heading: pick(brandFonts.heading, typography.heading, raw && raw.headingFont) || DEFAULT_FONTS.heading,
    body: pick(brandFonts.body, typography.body, raw && raw.bodyFont) || DEFAULT_FONTS.body,
    mono: pick(brandFonts.mono, typography.mono, raw && raw.monoFont) || DEFAULT_FONTS.mono,
  }
}

/** True when `family` should be requested from Google Fonts. */
function isGoogleFamily(family) {
  const f = cleanFamily(family)
  return !!f && !NON_GOOGLE_FAMILIES.has(f.toLowerCase())
}

/** Quote a family for CSS when needed ('Space Grotesk', Inter → 'Inter'). */
function quoteFamily(family) {
  const f = cleanFamily(family)
  if (!f) return ''
  if (NON_GOOGLE_FAMILIES.has(f.toLowerCase()) && !/\s/.test(f)) return f
  return `'${f.replace(/'/g, "\\'")}'`
}

/** Full CSS font stack for a family: quoted family + platform fallbacks. */
function fontStack(family, kind = 'sans') {
  const quoted = quoteFamily(family)
  const fallback = kind === 'mono' ? MONO_FALLBACK : SANS_FALLBACK
  return quoted ? `${quoted}, ${fallback}` : fallback
}

/** Unique Google families in heading → body → mono order. */
function googleFamilies(fonts) {
  const seen = new Set()
  const out = []
  for (const key of ['heading', 'body', 'mono']) {
    const f = cleanFamily(fonts && fonts[key])
    const id = f.toLowerCase()
    if (f && isGoogleFamily(f) && !seen.has(id)) {
      seen.add(id)
      out.push(f)
    }
  }
  return out
}

/** Google Fonts CSS2 URL for the brand's families ('' when none are Google fonts). */
function googleFontsHref(fonts, { weights = DEFAULT_WEIGHTS } = {}) {
  const families = googleFamilies(fonts)
  if (families.length === 0) return ''
  const wght = [...new Set(weights)].sort((a, b) => a - b).join(';')
  const params = families.map(
    (f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@${wght}`,
  )
  return `https://fonts.googleapis.com/css2?${params.join('&')}&display=swap`
}

/** <link> tags (preconnect + stylesheet) for index.html; '' when nothing to load. */
function googleFontsLinkTags(fonts, options) {
  const href = googleFontsHref(fonts, options)
  if (!href) return ''
  return [
    '<link rel="preconnect" href="https://fonts.googleapis.com" />',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    `<link href="${href}" rel="stylesheet" />`,
  ].join('\n    ')
}

module.exports = {
  DEFAULT_FONTS,
  DEFAULT_WEIGHTS,
  cleanFamily,
  resolveBrandFonts,
  isGoogleFamily,
  quoteFamily,
  fontStack,
  googleFamilies,
  googleFontsHref,
  googleFontsLinkTags,
}
