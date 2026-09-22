const { doubleCsrf } = require('csrf-csrf')

/**
 * CSRF protection middleware using double-submit cookie pattern.
 *
 * This middleware protects against Cross-Site Request Forgery attacks by:
 * 1. Generating a CSRF token stored in an httpOnly cookie
 * 2. Requiring clients to send this token in a custom header (X-CSRF-Token)
 * 3. Validating that both values match before processing state-changing requests
 *
 * The middleware automatically handles GET, HEAD, and OPTIONS requests as safe
 * and only validates tokens for POST, PUT, PATCH, DELETE requests.
 *
 * Usage:
 *   - Add csrfProtection middleware to routes that need CSRF protection
 *   - Expose generateCsrfToken() via a GET endpoint so clients can fetch the token
 *   - Clients must include the token in the X-CSRF-Token header for protected requests
 */
// CSRF_SECRET: required in production, auto-generated elsewhere.
// The Env SCHEMA (lib/@system/Env, `requiredIn: ['production']`) aborts boot
// with a readable report when it is missing; this throw is the defence in depth
// for any entrypoint that loads the middleware without going through Env.
// A per-process secret in production would differ between App Runner instances
// and across restarts, so tokens minted by one instance fail on another — that
// is a silent outage, not a degraded mode, hence fail fast.
// Dev/test auto-generate one so local work needs no setup (tokens must simply be
// re-fetched after a restart).
if (!process.env.CSRF_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[csrf] CSRF_SECRET is not set. It is required in production — generate one with ' +
      'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))" and set it in the environment.',
    )
  }
  const crypto = require('crypto')
  process.env.CSRF_SECRET = crypto.randomBytes(32).toString('hex')
}

// Cookie name used by the double-submit CSRF pattern.
// __Host- prefix requires the Secure attribute and HTTPS — use it only in production.
// Shared between doubleCsrf() config and the defense-in-depth cookie check.
const CSRF_COOKIE_NAME = process.env.NODE_ENV === 'production'
  ? '__Host-psifi.x-csrf-token'
  : 'psifi.x-csrf-token'

const {
  generateCsrfToken: _generateCsrfToken, // Generate a new CSRF token
  doubleCsrfProtection                    // Middleware to validate CSRF tokens
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || 'dev-only-csrf-placeholder-not-for-production',
  cookieName: CSRF_COOKIE_NAME,
  cookieOptions: {
    sameSite: 'strict',
    path: '/',
    secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
    httpOnly: true, // Prevent JavaScript access to the cookie
  },
  size: 64, // Token size in bytes
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'], // Safe methods that don't need CSRF protection
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'], // Custom header for the token
  getSessionIdentifier: (req) => {
    // Use session ID if available, otherwise fall back to a default empty string
    // This is safe because CSRF protection relies on the double-submit cookie pattern,
    // not on session identification
    return req.sessionID || req.session?.id || ''
  },
})

/**
 * Routes exempt from CSRF validation.
 *
 * Auth routes (login, register, password-reset) all require CSRF protection to
 * prevent login-CSRF attacks where an attacker tricks a victim into logging in
 * as the attacker's account.  Login routes use route-level requireCsrfPresence
 * middleware (#38791).
 *
 * Token refresh is exempt because the client-side refresh call does not carry
 * a CSRF header (it runs silently in the background before the user has
 * a valid session to attach a token from).
 *
 * Webhook routes receive server-to-server calls that can't carry CSRF tokens.
 * /api/v1/* is the programmatic API namespace; all access is via API keys, not browsers.
 */
const CSRF_EXEMPT_PATHS = [
  '/api/auth/refresh',
  '/api/sessions/refresh',
  '/api/webhook',
  '/api/stripe/webhook',
  '/api/payments/webhook',
  // GDPR cookie consent is fire-and-forget from anonymous visitors who have
  // no session or CSRF token.  The endpoint only inserts an audit-trail row
  // — no session-bound side-effects that CSRF protects against (#37341).
  '/api/gdpr/consent',
  // API v1 endpoints use API-key auth (Bearer token), not session cookies.
  // CSRF protection requires a session cookie to anchor the double-submit
  // pattern — it provides no security benefit for stateless API-key requests
  // and blocks legitimate machine-to-machine callers.
  '/api/v1/',
]

/**
 * Returns true if the request PRESENTS API-key credentials rather than a
 * browser session.  API-key callers cannot carry CSRF cookies (they are
 * server-to-server or CLI clients), so CSRF validation is both unnecessary
 * and harmful for them.
 *
 * Detected patterns:
 *   • X-API-Key header (any value)
 *   • Authorization: Bearer <token> where the token starts with a known
 *     API-key prefix (sk_)
 *
 * This runs before route-level authenticate(), so the key is NOT validated
 * here — see stripAmbientCredentials for why that is safe.
 *
 * Products should extend the regex with their own API-key prefixes
 * (e.g. /^(sk_|myapp_live_|myapp_test_)/) as needed.
 */
function isApiKeyRequest(req) {
  if (req.headers['x-api-key']) return true
  const auth = req.headers['authorization'] ?? ''
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7)
    return /^sk_/.test(token)
  }
  return false
}

/**
 * Make an API-key request genuinely stateless before it reaches any handler.
 *
 * CSRF is an attack on AMBIENT credentials: the browser attaches the victim's
 * cookies to a request the attacker forged.  The API-key exemption is evaluated
 * here, before authenticate() has validated the key, so we cannot know yet
 * whether the key is real.  Instead of trusting the header we remove what the
 * exemption could be abused for: every cookie is dropped, so the request can
 * only be authorised by the API key itself (which authenticate() rejects with
 * 401 when bogus).  A forged `X-API-Key: x` therefore reaches routes exactly as
 * an anonymous machine caller would — never as the logged-in victim.
 */
function stripAmbientCredentials(req) {
  req.cookies = {}
  req.signedCookies = {}
  delete req.headers.cookie
}

/**
 * CSRF protection middleware that validates tokens on state-changing requests
 */
const csrfProtection = (req, res, next) => {
  // Skip CSRF validation in test/development environments if needed
  if (process.env.NODE_ENV === 'test' || process.env.SKIP_CSRF === 'true') {
    return next()
  }

  // Skip CSRF for auth and webhook routes (no session to protect)
  // Check both full path (app-level mount) and stripped path (router-level mount)
  const fullPath = req.originalUrl || req.path
  if (CSRF_EXEMPT_PATHS.some(p => fullPath.startsWith(p) || req.path.startsWith(p) || req.path.startsWith(p.replace('/api', '')))) {
    return next()
  }

  // Skip CSRF for API-key requests — but only after making them stateless.
  // The key is validated later by authenticate(); what we guarantee here is
  // that no session cookie survives for a forged key to ride on.
  if (isApiKeyRequest(req)) {
    stripAmbientCredentials(req)
    return next()
  }

  // Defense-in-depth: reject state-changing requests before delegating to the
  // csrf-csrf library.  The library silently skips validation when the CSRF
  // cookie is absent (treats it as a first visit), so we must verify both the
  // X-CSRF-Token header AND the double-submit cookie are present.
  const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS']
  if (!SAFE_METHODS.includes(req.method)) {
    if (!req.headers['x-csrf-token']) {
      return res.status(403).json({
        message: 'Invalid or missing CSRF token',
        error: 'CSRF_VALIDATION_FAILED',
      })
    }
    if (!req.cookies?.[CSRF_COOKIE_NAME]) {
      return res.status(403).json({
        message: 'Invalid or missing CSRF token',
        error: 'CSRF_VALIDATION_FAILED',
      })
    }
  }

  doubleCsrfProtection(req, res, (err) => {
    if (err) {
      return res.status(403).json({
        message: 'Invalid or missing CSRF token',
        error: 'CSRF_VALIDATION_FAILED'
      })
    }
    next()
  })
}

/**
 * Middleware to generate and expose CSRF token to clients
 * Mount this on a GET endpoint (e.g., GET /api/csrf-token)
 */
const generateCsrfToken = (req, res) => {
  const token = _generateCsrfToken(req, res)
  res.json({ csrfToken: token })
}

/**
 * Export generateToken as an alias for compatibility
 */
const generateToken = _generateCsrfToken

/**
 * Lightweight route-level CSRF gate.  Checks that the X-CSRF-Token header
 * AND double-submit cookie are present on state-changing requests.
 * Does NOT perform cryptographic validation — that is left to the app-level
 * csrfProtection middleware.  Use as defense-in-depth on sensitive routes.
 */
function requireCsrfPresence(req, res, next) {
  if (process.env.NODE_ENV === 'test' || process.env.SKIP_CSRF === 'true') return next()
  const SAFE = ['GET', 'HEAD', 'OPTIONS']
  if (SAFE.includes(req.method)) return next()
  // API-key requests are stateless machine-to-machine calls — no browser cookies,
  // no session to steal, so CSRF protection provides no security value.
  // Consistent with csrfProtection above: the exemption is granted only once
  // ambient cookies have been dropped.
  if (isApiKeyRequest(req)) {
    stripAmbientCredentials(req)
    return next()
  }
  if (!req.headers['x-csrf-token'] || !req.cookies?.[CSRF_COOKIE_NAME]) {
    return res.status(403).json({
      message: 'Invalid or missing CSRF token',
      error: 'CSRF_VALIDATION_FAILED',
    })
  }
  next()
}

module.exports = {
  csrfProtection,
  generateCsrfToken,
  generateToken,
  isApiKeyRequest,
  stripAmbientCredentials,
  requireCsrfPresence,
}
