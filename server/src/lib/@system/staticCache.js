// @system — Cache-Control policy for the built client (client/dist) served by
// express.static in production.
//
// Webpack emits content-hashed filenames for everything it bundles
// (js/[name].[contenthash:8].js, css/[name].[contenthash:8].css,
// assets/[name].[contenthash:8][ext]) — a changed file is a new URL, so those may
// be cached for a year and marked immutable. Everything else keeps a short TTL:
// HTML must never be cached (spaFallback injects per-route meta and start.sh
// rewrites placeholders), and unhashed files copied from client/public or
// assets/ (favicons, logos, robots, manifest, cookie-consent.js, imported/…) can
// change between deploys under the same name.

const path = require('path')

const IMMUTABLE = 'public, max-age=31536000, immutable'
const HTML = 'no-cache, no-store, must-revalidate'
const SHORT = 'public, max-age=3600'

// js/main.93f1a327.js, js/429.9192ecb8.chunk.js, css/main.69fe672a.css (+ .gz/.br/.map)
const HASHED_BUNDLE_RE = /^(?:js|css)\/[^/]+\.[0-9a-f]{8}(?:\.chunk)?\.(?:js|css)(?:\.(?:gz|br|map))?$/i
// assets/[name].[contenthash:8][ext] — fonts/images emitted by webpack asset modules
// (assets/logos/… and assets/og/… are unhashed copies and do not match)
const HASHED_ASSET_RE = /^assets\/[^/]+\.[0-9a-f]{8}\.[a-z0-9]+(?:\.(?:gz|br))?$/i

/** Cache-Control for a path relative to the dist root ("js/main.1234abcd.js"). */
function cacheControlFor(relPath) {
  const p = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '')
  if (/\.html?$/i.test(p)) return HTML
  if (HASHED_BUNDLE_RE.test(p) || HASHED_ASSET_RE.test(p)) return IMMUTABLE
  return SHORT
}

/** express.static options for the dist directory (index handled by spaFallback). */
function staticOptions(rootDir) {
  return {
    index: false,
    // prerender.mjs creates dist/<route>/ directories; without this serve-static
    // would 301 `/menu` → `/menu/` instead of letting spaFallback serve the route.
    redirect: false,
    // express.static's maxAge would apply one value to everything; setHeaders
    // runs per file so hashed bundles and HTML get different policies.
    setHeaders(res, filePath) {
      res.setHeader('Cache-Control', cacheControlFor(path.relative(rootDir, filePath)))
    },
  }
}

module.exports = { cacheControlFor, staticOptions, IMMUTABLE, HTML, SHORT }
