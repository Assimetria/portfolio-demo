// @system — brand.json loader for server-side code.
//
// brand.json (repo root) is the single source of product configuration that
// Orkosi writes. Server modules that need a setting from it (CSP sources,
// route meta, contact-form options…) should read it through this loader
// instead of re-implementing the path resolution and the "missing file"
// handling each time.
//
// Resolution order: BRAND_JSON_PATH env → <repo root>/brand.json (relative to
// this file) → <cwd>/brand.json → /app/brand.json (Docker image). A missing or
// malformed file yields `{}` so callers can rely on optional chaining with
// defaults and the server never fails to boot because of a brand setting.

const fs = require('fs')
const path = require('path')

const CANDIDATES = () => [
  process.env.BRAND_JSON_PATH,
  path.resolve(__dirname, '../../../../../brand.json'),
  path.resolve(process.cwd(), 'brand.json'),
  '/app/brand.json',
].filter(Boolean)

let cache = null

/**
 * Read brand.json once and cache it for the process lifetime.
 *
 * @param {{ reload?: boolean }} [opts] pass `{ reload: true }` to bypass the cache (tests).
 * @returns {object} parsed brand.json, or `{}` when unavailable.
 */
function loadBrand({ reload = false } = {}) {
  if (cache && !reload) return cache
  for (const candidate of CANDIDATES()) {
    try {
      if (!fs.existsSync(candidate)) continue
      cache = JSON.parse(fs.readFileSync(candidate, 'utf8'))
      return cache
    } catch (_) {
      // fall through to the next candidate
    }
  }
  cache = {}
  return cache
}

/** Drop the cached brand (tests / hot reload). */
function resetBrandCache() {
  cache = null
}

module.exports = { loadBrand, resetBrandCache }
