// @system — CORS middleware
// Allow-list is built once at startup from APP_URL, RAILWAY_PUBLIC_DOMAIN and
// CORS_ORIGINS (comma-separated). Localhost dev origins are added ONLY when
// NODE_ENV !== 'production'. Rejected origins get a direct 403 (never a 500).

const cors = require('cors')

const IS_PROD = process.env.NODE_ENV === 'production'

const ALLOWED_ORIGINS = buildAllowedOrigins()

function buildAllowedOrigins() {
  const origins = new Set()

  // Explicit app URL (set in .env or derived by start.sh from RAILWAY_PUBLIC_DOMAIN)
  if (process.env.APP_URL) origins.add(process.env.APP_URL)

  // Railway auto-generated domain (may differ from APP_URL when a custom domain is configured)
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    origins.add(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`)
  }

  // Operator-defined extra origins — comma-separated list.
  // Use this to add Railway auto-generated URLs, custom domains, or staging URLs
  // that aren't captured by APP_URL or RAILWAY_PUBLIC_DOMAIN.
  if (process.env.CORS_ORIGINS) {
    for (const raw of process.env.CORS_ORIGINS.split(',')) {
      const trimmed = raw.trim()
      if (trimmed) origins.add(trimmed)
    }
  }

  // Local development origins — never in production. A production deploy that
  // needs them must list them explicitly in CORS_ORIGINS.
  if (!IS_PROD) {
    origins.add('http://localhost:5173')
    origins.add('http://localhost:3000')
    origins.add('http://127.0.0.1:5173')
    origins.add('http://127.0.0.1:3000')
  }

  return [...origins]
}

function isOriginAllowed(origin) {
  // Requests without an Origin header are NOT cross-origin browser requests — they come
  // from curl, Postman, server-to-server calls, or same-origin navigation. The browser
  // always sends an Origin header on cross-origin requests, so absence of Origin means
  // CORS enforcement doesn't apply. Allow these in all environments.
  // Production healthchecks still use /healthz (registered before CORS middleware).
  //
  // Also handle the string 'undefined' — Railway CDN edge proxies (Fastly/Varnish) may
  // serialise a missing Origin header as the literal string 'undefined'.
  if (!origin || origin === 'undefined') return true

  // Exact match only — wildcard subdomain matching removed (SEC-1500: attacker-registered subdomain risk)
  if (ALLOWED_ORIGINS.includes(origin)) return true

  return false
}

/**
 * CORS middleware with inline rejection handling.
 * Rejections return 403 directly without going through Express error handler.
 * This avoids the 500 status code that callback(err) can produce when the error
 * flows through middleware chains that strip/ignore err.status.
 */
const corsHandler = cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-CSRF-Token', 'X-Tenant-Id', 'X-Request-Id'],
  exposedHeaders: ['X-Total-Count', 'X-Request-Id'],
  maxAge: 600, // preflight cache 10 min
})

function corsMiddleware(req, res, next) {
  const origin = req.headers.origin

  if (isOriginAllowed(origin)) {
    // Allowed — delegate to cors package for proper header setting
    return corsHandler(req, res, next)
  }

  // Rejection: respond directly with 403 — never pass to next(err).
  // The origin value is not echoed back: it is attacker-controlled input.
  res.status(403).json({ message: 'CORS: origin not allowed' })
}

module.exports = corsMiddleware
module.exports.isOriginAllowed = isOriginAllowed
module.exports.ALLOWED_ORIGINS = ALLOWED_ORIGINS
