/**
 * @system Network helpers
 *
 * IP/network utilities shared across API surface where the raw `req.ip` /
 * `X-Forwarded-For` header handling would otherwise be duplicated:
 * client-IP extraction (behind a trusted proxy), IP normalisation,
 * sanitisation and private-network classification.
 *
 * Plain CommonJS module — mirrors the style of api-utils.js and response.js.
 * Kept free of runtime (geoip-lite) dependencies so it is trivially unit-testable.
 */

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/i
const IPV6_RE =
  /^[0-9a-f:]+$/i

/**
 * Normalise a raw IP string.
 *
 * - Strips the IPv4-mapped-IPv6 `::ffff:` prefix so `::ffff:192.0.2.1`
 *   becomes `192.0.2.1`.
 * - Maps `::1` (IPv6 loopback) to `127.0.0.1` for consistency with the
 *   GeoIP module.
 * - Lower-cases IPv6 and collapses leading zeros generally not needed; we
 *   simply trim and lowercase for stable keying in rate limiting/audit logs.
 *
 * @param {string|null|undefined} value - Raw IP value from a request
 * @returns {{ ip: string, valid: boolean }} Normalised IP + whether it parsed.
 */
function normalizeIp(value) {
  if (typeof value !== 'string') return { ip: '', valid: false }
  let ip = value.trim()
  if (!ip) return { ip: '', valid: false }

  // Take only the first entry when given a comma-separated X-Forwarded-For list.
  if (ip.includes(',')) ip = ip.split(',')[0].trim()

  // Normalise a bracketed IPv6 literal (`[::1]:443` -> `::1`) or an IPv4
  // `host:port`. Left untouched otherwise so bare IPv6 (`2001:db8::1`) and the
  // `::1` loopback shorthand are not mangled by naive port-stripping.
  if (ip.startsWith('[')) {
    const close = ip.indexOf(']')
    ip = close > -1 ? ip.slice(1, close) : ip
  } else if (/^(\d{1,3}\.){3}\d{1,3}:\d+$/.test(ip)) {
    ip = ip.slice(0, ip.lastIndexOf(':'))
  }

  // Unwrap IPv4-mapped IPv6 values (`::ffff:192.0.2.1` -> `192.0.2.1`) so the
  // dotted-octet tests below can treat them as plain IPv4.
  const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped && ipv4(mapped[1])) ip = mapped[1]
  else if (ip === '::1') ip = '127.0.0.1' // IPv6 loopback -> IPv4 loopback

  if (ipv4(ip)) return { ip, valid: true }
  if (IPV6_RE.test(ip)) return { ip: ip.toLowerCase(), valid: true }
  return { ip: '', valid: false }
}

/**
 * Private helper — does this string look like a dotted IPv4 address?
 *
 * @param {string} ip - Normalised candidate
 * @returns {boolean} True when all four octets are 0-255.
 */
function ipv4(ip) {
  const m = IPV4_RE.exec(ip)
  if (!m) return false
  return m.slice(1).every((o) => Number(o) >= 0 && Number(o) <= 255)
}

/**
 * Whether an IP address is on a private / non-routeable range.
 *
 * Handles loopback, RFC1918 private space, link-local (169.254.x.x), the
 * documentation/test ranges and IPv6 equivalents.
 *
 * @param {string} ip - IP to test
 * @returns {boolean} True for loopback/private/link-local/docs ranges.
 */
function isPrivateIp(ip) {
  const { ip: normalized, valid } = normalizeIp(ip)
  if (!valid) return false

  if (normalized === '127.0.0.1' || normalized === '::1') return true

  const m = IPV4_RE.exec(normalized)
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])]
    const c = Number(m[3])
    if (a === 10) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
    if (a === 127) return true
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
    return false
  }

  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  if (normalized.startsWith('fe80')) return true
  if (normalized === '::') return true
  return false
}

/**
 * Extract & normalise the best client IP from a request object.
 *
 * Preference order:
 *   1. `req.ip` (Express already honours `trust proxy` when enabled)
 *   2. first value of the `X-Forwarded-For` header chain
 *   3. `req.socket.remoteAddress` / `req.connection.remoteAddress`
 *
 * Returns an empty string when nothing usable is found.
 *
 * @param {Object} req - Express (or minimal) request object
 * @returns {string} Best-effort normalised client IP.
 */
function clientIpFromRequest(req) {
  if (!req) return ''

  const candidates = []
  if (typeof req.ip === 'string' && req.ip) candidates.push(req.ip)

  if (req.headers) {
    const xff = req.headers['x-forwarded-for']
    if (typeof xff === 'string' && xff) candidates.push(xff)
  }

  const remote =
    (req.socket && req.socket.remoteAddress) ||
    (req.connection && req.connection.remoteAddress) ||
    req.remoteAddress ||
    ''

  if (typeof remote === 'string' && remote) candidates.push(remote)

  for (const candidate of candidates) {
    const { ip, valid } = normalizeIp(candidate)
    if (valid) return ip
  }
  return ''
}

/**
 * Alias for {@link clientIpFromRequest} that reads like a middleware getter.
 *
 * When Express is configured with `trust proxy` it already populates `req.ip`
 * from the deproxied chain, so that value is preferred inside
 * {@link clientIpFromRequest}.
 *
 * @param {Object} req - Express request object
 * @returns {string} Normalised client IP ('' when unknown).
 */
function getClientIp(req) {
  return clientIpFromRequest(req)
}

/**
 * Sanitise a raw value to a validated IP string, or a fallback.
 *
 * Intended for writing user-supplied header values into audit logs safely.
 *
 * @param {string|undefined|null} value - Raw value
 * @param {string} [fallback=''] - Value returned when unparseable
 * @returns {string} Validated & normalised IP or fallback.
 */
function sanitizeIp(value, fallback = '') {
  const { ip, valid } = normalizeIp(value)
  return valid ? ip : fallback
}

/**
 * Resolve the country (2-letter code) for a request IP.
 *
 * Uses the @system GeoIP module, which itself degrades gracefully when the
 * optional `geoip-lite` package is not installed.
 *
 * @param {Object} req - Express request object (@system GeoIP.shape)
 * @returns {{ ip: string, country: string }} IP + country (or 'unknown').
 */
function resolveIpLocation(req) {
  const ip = getClientIp(req)
  const GeoIP = require('../GeoIP')
  const resolved = GeoIP.getLocationFromRequest(req) || {}
  return { ip, country: resolved.country || 'unknown' }
}

module.exports = {
  normalizeIp,
  isPrivateIp,
  clientIpFromRequest,
  getClientIp,
  sanitizeIp,
  resolveIpLocation,
}
