/**
 * @system — OAuth2 provider routes
 *
 * GET /api/auth/google           → redirect to Google consent page
 * GET /api/auth/google/callback  → exchange code, issue JWT, redirect to /app
 * GET /api/auth/github           → redirect to GitHub authorize page
 * GET /api/auth/github/callback  → exchange code, issue JWT, redirect to /app
 *
 * On success → redirect to APP_URL/app
 * On failure → redirect to APP_URL/auth?error=oauth_failed
 */

const express = require('express')
const router = express.Router()
const google = require('../../../lib/@system/OAuth/google')
const github = require('../../../lib/@system/OAuth/github')
const UserRepo = require('../../../db/repos/@system/UserRepo')
const OAuthRepo = require('../../../db/repos/@system/OAuthRepo')
const { signTokenAsync } = require('../../../lib/@system/Helpers/jwt')
const logger = require('../../../lib/@system/Logger')
const { defaultOf } = require('../../../lib/@system/Env/schema')
const { oauthLimiter } = require('../../../lib/@system/RateLimit')

const SESSION_TTL = 7 * 24 * 60 * 60 // 7 days in seconds

/**
 * Returns the validated APP_URL from environment variables.
 * SECURITY: Validates that APP_URL is a safe origin to prevent open redirects.
 * 
 * @returns {string} Validated app URL
 * @throws {Error} If APP_URL is invalid or potentially malicious
 */
function appUrl() {
  const rawUrl = process.env.APP_URL ?? 'http://localhost:5173'
  
  try {
    const url = new URL(rawUrl)
    
    // SECURITY: Only allow http/https protocols (prevent javascript:, data:, file:, etc.)
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error(`Invalid APP_URL protocol: ${url.protocol}`)
    }
    
    // SECURITY: Prevent URLs with embedded credentials
    if (url.username || url.password) {
      throw new Error('APP_URL cannot contain credentials')
    }
    
    // Return URL without trailing slash for consistency
    return url.origin + url.pathname.replace(/\/$/, '')
  } catch (err) {
    // If URL parsing fails, fall back to localhost (safe default)
    logger.error({ err, rawUrl }, 'Invalid APP_URL in environment, falling back to localhost')
    return 'http://localhost:5173'
  }
}

function serverUrl() {
  // PORT is normally already defaulted by lib/@system/Env at boot; the schema
  // default is the single fallback for contexts that skip that bootstrap (tests).
  const port = process.env.PORT ?? defaultOf('PORT')
  return process.env.SERVER_URL ?? `http://localhost:${port}`
}

/**
 * Creates a safe redirect URL for OAuth flows.
 * SECURITY: Ensures redirects are always to the validated APP_URL origin.
 * 
 * @param {string} path - Path to append (e.g., '/app', '/auth')
 * @param {Object} params - Query parameters to include (sanitized)
 * @returns {string} Safe redirect URL
 */
function safeRedirectUrl(path, params = {}) {
  const base = appUrl()
  const url = new URL(path, base)
  
  // SECURITY: Ensure the final URL is still on our domain
  // (prevents path traversal like /../../evil.com)
  if (url.origin !== new URL(base).origin) {
    logger.warn({ base, path, resultOrigin: url.origin }, 'Attempted redirect to different origin, using safe default')
    return `${base}/app` // Safe fallback
  }
  
  // Add sanitized query parameters (whitelist approach)
  Object.entries(params).forEach(([key, value]) => {
    // Only add safe, non-user-controlled parameters
    if (typeof value === 'string' && value.length < 100) {
      url.searchParams.set(key, value)
    }
  })
  
  return url.toString()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * After a successful OAuth profile fetch, find or create the linked user,
 * issue a JWT cookie, and redirect to the app.
 */
async function handleOAuthSuccess({ res, provider, providerId, email, name }) {
  let user = await OAuthRepo.findUserByProvider(provider, providerId)

  if (!user) {
    // Check if a local account with the same email already exists
    if (email) {
      user = await UserRepo.findByEmail(email)
    }

    if (!user) {
      // Create a new user — password_hash is NULL for OAuth users
      user = await UserRepo.createOAuth({ email, name })
    }

    // Link this OAuth identity to the user
    await OAuthRepo.linkProvider({ userId: user.id, provider, providerId, email })
  }

  const token = await signTokenAsync({ userId: user.id })
  res.cookie('access_token', token, { httpOnly: true, secure: true, sameSite: 'strict', maxAge: SESSION_TTL * 1000 })
  
  // SECURITY: Use safe redirect helper
  res.redirect(safeRedirectUrl('/app'))
}

/**
 * Handles OAuth errors by logging and redirecting to the auth page with a safe error message.
 * SECURITY: Error message is hardcoded to prevent open redirect vulnerabilities.
 * User-controlled error values from OAuth providers are NOT included in the redirect.
 * 
 * @param {Response} res - Express response object
 * @param {Error} err - Error object (for logging only, not exposed to redirect)
 * @param {string} provider - OAuth provider name (for logging)
 */
function handleOAuthError(res, err, provider) {
  logger.error({ err, provider }, `OAuth ${provider} error`)
  
  // SECURITY: Use safe redirect with hardcoded error parameter
  // DO NOT include err.message or any user-controlled data in the redirect
  // The error parameter is intentionally hardcoded to 'oauth_failed'
  res.redirect(safeRedirectUrl('/auth', { error: 'oauth_failed' }))
}

// ─── Google ───────────────────────────────────────────────────────────────────

router.get('/auth/google', oauthLimiter, (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) return res.status(501).json({ message: 'Google OAuth is not configured' })

  const redirectUri = `${serverUrl()}/api/auth/google/callback`
  const url = google.getAuthUrl({ clientId, redirectUri })
  res.redirect(url)
})

router.get('/auth/google/callback', oauthLimiter, async (req, res) => {
  const { code, error } = req.query
  
  // SECURITY: The 'error' from req.query is user-controlled (from OAuth provider)
  // We log it but DO NOT include it in any redirect URL
  if (error || !code) return handleOAuthError(res, new Error(error ?? 'missing_code'), 'google')

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = `${serverUrl()}/api/auth/google/callback`

    const tokens = await google.exchangeCode({ code, clientId, clientSecret, redirectUri })
    const profile = await google.getUserInfo(tokens.access_token)

    await handleOAuthSuccess({
      res,
      provider: 'google',
      providerId: profile.sub,
      email: profile.email,
      name: profile.name,
    })
  } catch (err) {
    handleOAuthError(res, err, 'google')
  }
})

// ─── GitHub ───────────────────────────────────────────────────────────────────

router.get('/auth/github', oauthLimiter, (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID
  if (!clientId) return res.status(501).json({ message: 'GitHub OAuth is not configured' })

  const redirectUri = `${serverUrl()}/api/auth/github/callback`
  const url = github.getAuthUrl({ clientId, redirectUri })
  res.redirect(url)
})

router.get('/auth/github/callback', oauthLimiter, async (req, res) => {
  const { code, error } = req.query
  
  // SECURITY: The 'error' from req.query is user-controlled (from OAuth provider)
  // We log it but DO NOT include it in any redirect URL
  if (error || !code) return handleOAuthError(res, new Error(error ?? 'missing_code'), 'github')

  try {
    const clientId = process.env.GITHUB_CLIENT_ID
    const clientSecret = process.env.GITHUB_CLIENT_SECRET
    const redirectUri = `${serverUrl()}/api/auth/github/callback`

    const tokens = await github.exchangeCode({ code, clientId, clientSecret, redirectUri })
    const profile = await github.getUserInfo(tokens.access_token)

    await handleOAuthSuccess({
      res,
      provider: 'github',
      providerId: profile.id,
      email: profile.email,
      name: profile.name,
    })
  } catch (err) {
    handleOAuthError(res, err, 'github')
  }
})

module.exports = router
