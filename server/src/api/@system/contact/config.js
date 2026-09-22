// @system — Contact-form configuration resolved from brand.json + env.
//
// Single place that answers "how long do we keep submissions?" and "is
// Cloudflare Turnstile enforced?" so the router, the repo, the retention
// migration and the purge task all agree.
//
//   retention days   brand.site.contact.retentionDays → CONTACT_RETENTION_DAYS → 180
//   turnstile        site key from brand.site.contact.turnstile.siteKey,
//                    secret from TURNSTILE_SECRET_KEY. Enforced only when BOTH
//                    are present — a site key without a secret would render a
//                    widget nobody verifies, a secret without a site key would
//                    reject every visitor.
//
// brand.json is read defensively (`site` block is optional) so the template
// works before Orkosi writes any contact settings.

const { loadBrand } = require('../../../lib/@system/Brand')

const DEFAULT_RETENTION_DAYS = 180
const MIN_RETENTION_DAYS = 1
const MAX_RETENTION_DAYS = 3650

function contactBlock(brand) {
  const site = brand && typeof brand.site === 'object' ? brand.site : null
  const contact = site && typeof site.contact === 'object' ? site.contact : null
  return contact || {}
}

function toDays(value) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < MIN_RETENTION_DAYS || n > MAX_RETENTION_DAYS) return null
  return n
}

/**
 * Retention window for contact submissions, in whole days.
 * @param {object} [brand] injected for tests; defaults to brand.json.
 */
function retentionDays(brand = loadBrand()) {
  return (
    toDays(contactBlock(brand).retentionDays) ??
    toDays(process.env.CONTACT_RETENTION_DAYS) ??
    DEFAULT_RETENTION_DAYS
  )
}

/**
 * Turnstile settings. `enforced` is the only flag the router/client should
 * branch on; `siteKey` is safe to expose publicly (it is embedded in HTML by
 * design), `secretKey` never leaves the server.
 */
function turnstile(brand = loadBrand()) {
  const cfg = contactBlock(brand).turnstile
  const siteKey = cfg && typeof cfg.siteKey === 'string' ? cfg.siteKey.trim() : ''
  const secretKey = (process.env.TURNSTILE_SECRET_KEY || '').trim()
  const enforced = Boolean(siteKey && secretKey)
  return { siteKey: enforced ? siteKey : '', secretKey, enforced }
}

/** Public, cache-safe view served by GET /api/contact/config. */
function publicConfig(brand = loadBrand()) {
  const t = turnstile(brand)
  return {
    retentionDays: retentionDays(brand),
    turnstile: { siteKey: t.siteKey },
  }
}

module.exports = {
  DEFAULT_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
  MAX_RETENTION_DAYS,
  retentionDays,
  turnstile,
  publicConfig,
}
