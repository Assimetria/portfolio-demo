/**
 * @system — Google OAuth2 helpers
 *
 * Implements the Authorization Code flow using native fetch (Node 18+).
 * No passport or googleapis dependency needed.
 *
 * Flow:
 *   1. getAuthUrl()       → redirect user to Google consent page
 *   2. exchangeCode(code) → exchange authorization code for tokens
 *   3. getUserInfo(token) → fetch the authenticated user's profile
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'
const SCOPE = 'openid email profile'

/**
 * Builds the Google OAuth2 authorization URL to redirect the user to.
 */
function getAuthUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'online',
    ...(state ? { state } : {}),
  })
  return `${GOOGLE_AUTH_URL}?${params}`
}

/**
 * Exchanges an authorization code for an access token.
 * Returns the token response object (access_token, id_token, etc.).
 */
async function exchangeCode({ code, clientId, clientSecret, redirectUri }) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  const data = await res.json()
  if (!res.ok || data.error) {
    throw new Error(data.error_description ?? data.error ?? 'Google token exchange failed')
  }
  return data
}

/**
 * Fetches the authenticated user's profile from Google using an access token.
 * Returns { sub, email, name, picture, email_verified }
 */
async function getUserInfo(accessToken) {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json()
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? 'Failed to fetch Google user info')
  }
  return data
}

module.exports = { getAuthUrl, exchangeCode, getUserInfo }
