// @system — SPA fallback middleware with per-route SEO meta injection (#35132)
//
// Express is the only web server in the image, so every SPA route lands here.
// This middleware reads the built index.html (cached in memory), injects route-specific
// title/description/og:* meta tags, and serves it. Crawlers see unique metadata
// per route instead of the generic homepage title on every page.
//
// Known-route detection (#36237): Returns HTTP 404 for paths that don't match any
// route in the React manifest. The HTML is still served (users see the branded
// NotFoundPage), but the status code tells search engines not to index the page.
//
// Prerendered routes: client/scripts/prerender.mjs (postbuild) writes
// dist/index.html for `/` and dist/<route>/index.html for every static route in
// routes/@custom/index.jsx, plus dist/prerender.json listing them. When a
// route-specific snapshot exists it is served instead of the shell (crawlers get
// that page's rendered content), and the route counts as known (200) even though
// @custom routes are not in the @system manifest — the build proved it exists.

const fs = require('fs')
const path = require('path')

// Load route metadata — prefer @custom override, fall back to @system
let routeMetaModule
try {
  routeMetaModule = require('./routeMeta')
  const customPath = path.resolve(__dirname, '../@custom/routeMeta')
  routeMetaModule = require(customPath)
} catch (_) {
  routeMetaModule = require('./routeMeta')
}
const { getRouteMeta } = routeMetaModule

let cachedHtml = null

// ── Known-route detection (#36237) ──────────────────────────────────────────
// Loads the React route manifest and builds a lookup structure so the server
// can distinguish known routes (200) from unknown ones (404).

let knownRoutesCache = null

function buildKnownRoutes(manifest) {
  const exact = new Set()
  const prefixes = []

  for (const route of (manifest.static || [])) {
    if (route.path.includes(':')) {
      // Parameterised: /blog/:slug → prefix-match /blog/
      const prefix = route.path.split('/:')[0]
      prefixes.push(prefix + '/')
    } else {
      exact.add(route.path)
    }
  }

  // App routes — /app and everything under it
  for (const route of (manifest.app || [])) {
    exact.add(route.path)
  }
  prefixes.push('/app/')

  // Redirect sources
  for (const redirect of (manifest.redirects || [])) {
    if (redirect.from.endsWith('/*')) {
      const base = redirect.from.slice(0, -2)
      exact.add(base)
      prefixes.push(base + '/')
    } else {
      exact.add(redirect.from)
    }
  }

  return { exact, prefixes }
}

function loadKnownRoutes() {
  if (knownRoutesCache !== null) return knownRoutesCache

  const candidates = [
    path.resolve(process.cwd(), 'client/src/app/routes/@system/manifest.json'),
    path.resolve(__dirname, '../../../../client/src/app/routes/@system/manifest.json'),
    '/app/route-manifest.json',
  ]

  for (const p of candidates) {
    try {
      const manifest = JSON.parse(fs.readFileSync(p, 'utf8'))
      knownRoutesCache = buildKnownRoutes(manifest)
      return knownRoutesCache
    } catch (_) { /* try next */ }
  }

  knownRoutesCache = false // tried and failed — fail open
  return false
}

function isKnownRoute(pathname) {
  if (prerenderedHtml(pathname) !== null) return true // built by prerender.mjs from routes/@custom
  const routes = loadKnownRoutes()
  if (!routes) return true // manifest unavailable — fail open (200)
  if (routes.exact.has(pathname)) return true
  return routes.prefixes.some(p => pathname.startsWith(p))
}

function htmlDirs() {
  return [
    process.env.SPA_HTML_DIR,
    path.resolve(process.cwd(), 'client/dist'),
  ].filter(Boolean)
}

function loadHtml() {
  if (cachedHtml) return cachedHtml

  for (const dir of htmlDirs()) {
    try {
      cachedHtml = fs.readFileSync(path.join(dir, 'index.html'), 'utf8')
      return cachedHtml
    } catch (_) { /* try next */ }
  }

  return null
}

// ── Prerendered per-route HTML ───────────────────────────────────────────────
// dist/<route>/index.html, written by client/scripts/prerender.mjs. Looked up
// once per distinct path and cached (including misses) so the hot path never
// touches the filesystem twice for the same route.

const SAFE_ROUTE_RE = /^\/[A-Za-z0-9._~\-/]*$/
const prerenderedCache = new Map()

/**
 * Relative file for a route's prerendered snapshot, or null when the path is
 * `/`, has an extension, or contains anything that could escape the dist dir.
 */
function prerenderedRelPath(pathname) {
  if (typeof pathname !== 'string' || pathname === '/' || !SAFE_ROUTE_RE.test(pathname) || pathname.includes('//')) return null
  const trimmed = pathname.replace(/\/+$/, '')
  if (!trimmed) return null
  const segments = trimmed.split('/').filter(Boolean)
  if (segments.some((s) => s === '.' || s === '..' || s.startsWith('.'))) return null
  if (/\.\w{2,5}$/.test(segments[segments.length - 1])) return null
  return path.join(...segments, 'index.html')
}

/** Prerendered HTML for `pathname` or null (cached). */
function prerenderedHtml(pathname) {
  const rel = prerenderedRelPath(pathname)
  if (!rel) return null
  const key = rel
  if (prerenderedCache.has(key)) return prerenderedCache.get(key)
  let html = null
  for (const dir of htmlDirs()) {
    const file = path.join(dir, rel)
    // Resolved file must stay inside dir (defence in depth on top of SAFE_ROUTE_RE).
    if (!file.startsWith(path.resolve(dir) + path.sep)) continue
    try {
      html = fs.readFileSync(file, 'utf8')
      break
    } catch (_) { /* try next */ }
  }
  prerenderedCache.set(key, html)
  return html
}

/** HTML to serve for a route: its prerendered snapshot when present, else the shell. */
function loadHtmlFor(pathname) {
  const snapshot = prerenderedHtml(pathname)
  return snapshot !== null ? snapshot : loadHtml()
}

/** Test hook: forget cached HTML + route lookups (env/dist changed). */
function resetCaches() {
  cachedHtml = null
  knownRoutesCache = null
  prerenderedCache.clear()
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function injectMeta(html, meta, fullUrl) {
  let out = html

  // Replace <title>
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(meta.title)}</title>`)

  // Replace meta description
  out = out.replace(
    /(<meta\s+name="description"\s+content=")[^"]*"/,
    `$1${escapeAttr(meta.description)}"`
  )

  // Replace og:title and og:description
  out = out.replace(
    /(<meta\s+property="og:title"\s+content=")[^"]*"/,
    `$1${escapeAttr(meta.title)}"`
  )
  out = out.replace(
    /(<meta\s+property="og:description"\s+content=")[^"]*"/,
    `$1${escapeAttr(meta.description)}"`
  )

  // Replace twitter:title and twitter:description
  out = out.replace(
    /(<meta\s+name="twitter:title"\s+content=")[^"]*"/,
    `$1${escapeAttr(meta.title)}"`
  )
  out = out.replace(
    /(<meta\s+name="twitter:description"\s+content=")[^"]*"/,
    `$1${escapeAttr(meta.description)}"`
  )

  // Replace og:url, twitter:url, and canonical with per-route URL
  if (fullUrl) {
    const origin = fullUrl.replace(/(https?:\/\/[^/]+).*/, '$1')

    out = out.replace(
      /(<meta\s+property="og:url"\s+content=")[^"]*"/,
      `$1${escapeAttr(fullUrl)}"`
    )
    out = out.replace(
      /(<meta\s+name="twitter:url"\s+content=")[^"]*"/,
      `$1${escapeAttr(fullUrl)}"`
    )
    out = out.replace(
      /(<link\s+rel="canonical"\s+href=")[^"]*"/,
      `$1${escapeAttr(fullUrl)}"`
    )

    // Replace __PAGE_URL__ with the per-route URL and __APP_URL__ with origin;
    // start.sh only substitutes __APP_URL__, and __PAGE_URL__ is per request. (#37254, #56982)
    out = out.replace(/__PAGE_URL__/g, fullUrl)
    out = out.replace(/__APP_URL__/g, origin)
  }

  return out
}

/**
 * Express middleware: serves index.html with per-route SEO meta for SPA routes.
 * Must be registered AFTER API routes and BEFORE the 404 catch-all.
 */
function spaFallback(req, res, next) {
  // Only serve HTML for navigation requests (GET/HEAD)
  if (req.method !== 'GET' && req.method !== 'HEAD') return next()

  // Skip API routes and health checks — they return JSON
  if (req.path.startsWith('/api')) return next()
  if (req.path === '/health' || req.path === '/healthz') return next()

  // Skip requests for static files (have file extensions)
  if (/\.\w{2,5}$/.test(req.path)) return next()

  const html = loadHtmlFor(req.path)
  if (!html) return next()

  const meta = getRouteMeta(req.path)
  const knownRoute = isKnownRoute(req.path)
  const origin = `${req.protocol}://${req.get('host')}`
  // For 404 pages, set canonical/og:url to homepage so crawlers don't index
  // nonexistent URLs as canonical (#52063).
  const seoUrl = knownRoute ? `${origin}${req.path}` : origin
  let injected = injectMeta(html, meta, seoUrl)

  // Inject noindex for 404 pages — defense-in-depth alongside the 404 status
  // code. Some crawlers ignore status codes but respect meta robots. (#52063)
  if (!knownRoute) {
    injected = injected.replace(
      '<head>',
      '<head>\n    <meta name="robots" content="noindex, nofollow" />'
    )
  }

  // Return 404 for paths that don't match any known route (#36237).
  // The HTML is still served so users see the branded NotFoundPage.
  const statusCode = knownRoute ? 200 : 404

  res.status(statusCode)
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  // Only set Cache-Control if a route/middleware upstream already chose one. (#36668)
  if (!res.hasHeader('Cache-Control')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  }
  res.send(injected)
}

module.exports = spaFallback
// Internals for unit tests (server/test/unit/@system/spa-fallback-prerender.test.js)
module.exports.prerenderedRelPath = prerenderedRelPath
module.exports.prerenderedHtml = prerenderedHtml
module.exports.loadHtmlFor = loadHtmlFor
module.exports.isKnownRoute = isKnownRoute
module.exports.resetCaches = resetCaches
