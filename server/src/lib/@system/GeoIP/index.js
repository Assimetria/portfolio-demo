// @system — GeoIP location detection
// Mirrors Asymetric Ventures' geoip-lite integration (Helpers/network.js).
// Used for session tracking and conversion-tracking country attribution.
'use strict'

let geoip
try {
  geoip = require('geoip-lite')
} catch {
  // geoip-lite is an optional dependency
  geoip = null
}

/**
 * Extract client IP and resolve to country using geoip-lite.
 * Falls back gracefully when geoip-lite is not installed.
 */
function getLocationFromRequest(req) {
  let header = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || ''

  // Extract IPv4 address if available
  const ipv4Match = header.match(/(\d{1,3}\.){3}\d{1,3}/)
  let ip = ipv4Match ? ipv4Match[0] : header

  // Convert IPv6 loopback to IPv4 loopback
  if (ip === '::1') ip = '127.0.0.1'

  const isLocalhost = ip === '127.0.0.1'

  let country = isLocalhost ? 'localhost' : 'unknown'
  if (!isLocalhost && geoip) {
    const geo = geoip.lookup(ip)
    if (geo) country = geo.country
  }

  return { ip, country }
}

module.exports = { getLocationFromRequest }
