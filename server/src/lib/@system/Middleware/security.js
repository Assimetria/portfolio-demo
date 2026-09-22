// @system — security headers middleware (helmet + Permissions-Policy)
// CSP sources come from brand.json (`securityHeaders.contentSecurityPolicy`,
// camelCase — the format written by Orkosi provisioning; the legacy snake_case
// `security_headers.content_security_policy` shape is accepted too) so that
// brand.json stays the single source of truth for the policy.

const helmet = require('helmet')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { isEnabled: isModuleEnabled } = require('../Helpers/modules')

// Compute a CSP sha256 hash for an inline <script> placed right before </body>
// in the built index.html, if a product ever adds one. The template itself ships
// none (cookie consent is the external /cookie-consent.js + React banner), so
// this returns null and script-src carries no hash. (#39126, #44153)
function computeInlineScriptHash() {
  const candidates = [
    process.env.SPA_HTML_DIR && path.join(process.env.SPA_HTML_DIR, 'index.html'),
    path.resolve(process.cwd(), 'client/dist/index.html'),
  ].filter(Boolean)

  for (const p of candidates) {
    try {
      const html = fs.readFileSync(p, 'utf8')
      const m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)
      if (m) {
        return `'sha256-${crypto.createHash('sha256').update(m[1], 'utf8').digest('base64')}'`
      }
    } catch (_) { /* try next */ }
  }
  return null
}

const inlineHash = computeInlineScriptHash()

// ── brand.json CSP ─────────────────────────────────────────────────────────

/** Directive names we accept from brand.json, mapped from both key styles. */
const DIRECTIVE_KEYS = {
  scriptSrc: ['scriptSrc', 'script_src', 'script-src'],
  connectSrc: ['connectSrc', 'connect_src', 'connect-src'],
  styleSrc: ['styleSrc', 'style_src', 'style-src'],
  fontSrc: ['fontSrc', 'font_src', 'font-src'],
  imgSrc: ['imgSrc', 'img_src', 'img-src'],
  frameSrc: ['frameSrc', 'frame_src', 'frame-src'],
  mediaSrc: ['mediaSrc', 'media_src', 'media-src'],
}

/**
 * Normalise a brand.json CSP block (any key style) into
 * `{ scriptSrc?: string[], connectSrc?: string[], ... }`. Only non-empty
 * array-valued directives made of strings are accepted; anything else is
 * ignored so the helmet defaults apply (an empty array would otherwise
 * become an empty directive and block every source).
 */
function normalizeBrandCsp(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [directive, aliases] of Object.entries(DIRECTIVE_KEYS)) {
    for (const alias of aliases) {
      const value = raw[alias]
      // Empty arrays fall through to the safe defaults: a provisioning write of
      // `scriptSrc: []` must never blank a directive.
      if (Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === 'string')) {
        out[directive] = [...value]
        break
      }
    }
  }
  return out
}

/** Read brand.json and return the CSP block in either supported shape. */
const TURNSTILE_HOST = 'https://challenges.cloudflare.com'

/**
 * Cloudflare Turnstile is opt-in (brand.json site.contact.turnstile.siteKey +
 * TURNSTILE_SECRET_KEY, see api/@system/contact). When the site key is set the
 * widget script and its iframe must be allowed — derived from brand.json so the
 * CSP can never disagree with the contact form.
 */
function loadTurnstileEnabled(brandPath = path.resolve(__dirname, '../../../../../brand.json')) {
  try {
    const brand = JSON.parse(fs.readFileSync(brandPath, 'utf8'))
    return Boolean(brand?.site?.contact?.turnstile?.siteKey)
  } catch {
    return false
  }
}

function loadBrandCsp(brandPath = path.resolve(__dirname, '../../../../../brand.json')) {
  try {
    const brand = JSON.parse(fs.readFileSync(brandPath, 'utf8'))
    const block =
      brand.securityHeaders?.contentSecurityPolicy ??
      brand.security_headers?.content_security_policy ??
      {}
    return normalizeBrandCsp(block)
  } catch {
    return {}
  }
}

const GOOGLE_FONTS_CSS = 'https://fonts.googleapis.com'
const GOOGLE_FONTS_FILES = 'https://fonts.gstatic.com'

/** Add `extra` entries to `list` without duplicates. */
function withSources(list, extra) {
  const out = [...list]
  for (const e of extra) if (!out.includes(e)) out.push(e)
  return out
}

/**
 * Build the final CSP directive map from brand.json values + safe defaults.
 * Exported for unit tests.
 */
function buildCspDirectives(
  brandCsp = loadBrandCsp(),
  {
    hash = inlineHash,
    isProd = process.env.NODE_ENV === 'production',
    billing = isModuleEnabled('billing'),
    turnstile = loadTurnstileEnabled(),
  } = {},
) {
  // Stripe hosts belong to the billing feature module (brand.json `modules`):
  // an informational site with billing off must not advertise them in its
  // policy. Explicit brand.json values always win over these defaults.
  const stripeScript = billing ? ['https://js.stripe.com'] : []
  const stripeConnect = billing ? ['https://api.stripe.com'] : []

  // script-src: brand.json or sensible defaults, then the inline script hash
  // if one was computed (see computeInlineScriptHash). (#43082)
  let scriptSrc = [...(brandCsp.scriptSrc || ["'self'", ...stripeScript])]
  if (hash && !scriptSrc.includes(hash)) {
    const idx = scriptSrc.indexOf("'self'")
    scriptSrc.splice(idx + 1, 0, hash)
  }
  // Turnstile (opt-in, brand.json site.contact.turnstile.siteKey): widget script + challenge iframe.
  const turnstileHosts = turnstile ? [TURNSTILE_HOST] : []
  scriptSrc = withSources(scriptSrc, turnstileHosts)

  // Brand fonts are loaded from Google Fonts at build time — always allow the
  // CSS host in style-src and the font-file host in font-src.
  const styleSrc = withSources(
    brandCsp.styleSrc || ["'self'", "'unsafe-inline'"],
    [GOOGLE_FONTS_CSS],
  )
  const fontSrc = withSources(
    brandCsp.fontSrc || ["'self'", 'data:'],
    [GOOGLE_FONTS_FILES],
  )

  return {
    defaultSrc: ["'self'"],
    scriptSrc,
    styleSrc,
    imgSrc: brandCsp.imgSrc || ["'self'", 'data:', 'https:'],
    connectSrc: brandCsp.connectSrc || ["'self'", ...stripeConnect, 'https://*.plausible.io'],
    fontSrc,
    objectSrc: ["'none'"],
    mediaSrc: brandCsp.mediaSrc || ["'self'"],
    frameSrc: withSources(brandCsp.frameSrc || (billing ? ['https://js.stripe.com'] : ["'self'"]), turnstileHosts),
    upgradeInsecureRequests: isProd ? [] : null,
  }
}

const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: buildCspDirectives(),
  },

  // Only send HSTS in production (HTTPS environments)
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,

  // Prevent clickjacking
  frameguard: { action: 'deny' },

  // Prevent MIME sniffing
  noSniff: true,

  // Referrer policy — don't leak full URL to third parties
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

  // Disable X-Powered-By (already done by helmet by default)
  hidePoweredBy: true,

  // Cross-Origin policies
  crossOriginEmbedderPolicy: false, // set to true only if you need SharedArrayBuffer
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-site' },

  // Prevent browsers from performing DNS prefetching for external links
  dnsPrefetchControl: { allow: false },

  // Prevent IE from executing downloads in the site's context (#40898)
  xDownloadOptions: true,

  // Prevent Adobe Flash/Acrobat from loading data from this domain
  xPermittedCrossDomainPolicies: { permittedPolicies: 'none' },
})

// Permissions-Policy — helmet 7.x does not set this header automatically.
// Restrict access to sensitive browser features. Extend the allow-list as
// needed when specific features (e.g. payment, geolocation) are required.
function permissionsPolicy(_req, res, next) {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
  )
  // X-XSS-Protection: 0 — explicitly disables the legacy browser XSS auditor.
  // The header is deprecated and removed from Chrome 78+/Firefox but setting
  // it to 0 prevents the auditor from being exploited in older browsers.
  // Helmet 7.x does not include this header; we set it manually.
  res.setHeader('X-XSS-Protection', '0')
  next()
}

// Compose as a single middleware so callers use `app.use(securityHeaders)`
function securityHeaders(req, res, next) {
  helmetMiddleware(req, res, (err) => {
    if (err) return next(err)
    permissionsPolicy(req, res, next)
  })
}

module.exports = securityHeaders
module.exports.loadBrandCsp = loadBrandCsp
module.exports.loadTurnstileEnabled = loadTurnstileEnabled
module.exports.normalizeBrandCsp = normalizeBrandCsp
module.exports.buildCspDirectives = buildCspDirectives
