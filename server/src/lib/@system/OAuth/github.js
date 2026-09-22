/**
 * @system — GitHub OAuth2 helpers
 *
 * Implements the Authorization Code flow using native fetch (Node 18+).
 *
 * Flow:
 *   1. getAuthUrl()       → redirect user to GitHub authorize page
 *   2. exchangeCode(code) → exchange authorization code for an access token
 *   3. getUserInfo(token) → fetch the authenticated user's profile + primary email
 */

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize'
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const GITHUB_USER_URL = 'https://api.github.com/user'
const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails'
const SCOPE = 'read:user user:email'

/**
 * Builds the GitHub OAuth authorization URL.
 */
function getAuthUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPE,
    ...(state ? { state } : {}),
  })
  return `${GITHUB_AUTH_URL}?${params}`
}

/**
 * Exchanges an authorization code for a GitHub access token.
 */
async function exchangeCode({ code, clientId, clientSecret, redirectUri }) {
  const res = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  })

  const data = await res.json()
  if (!res.ok || data.error) {
    throw new Error(data.error_description ?? data.error ?? 'GitHub token exchange failed')
  }
  return data
}

/**
 * Fetches the authenticated GitHub user's profile and primary verified email.
 * Returns { id, login, name, email }
 */
async function getUserInfo(accessToken) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }

  const [userRes, emailsRes] = await Promise.all([
    fetch(GITHUB_USER_URL, { headers }),
    fetch(GITHUB_EMAILS_URL, { headers }),
  ])

  const user = await userRes.json()
  if (!userRes.ok) throw new Error(user.message ?? 'Failed to fetch GitHub user')

  let primaryEmail = user.email

  // GitHub may not expose the email in the user endpoint — fetch it separately
  if (!primaryEmail && emailsRes.ok) {
    const emails = await emailsRes.json()
    const primary = emails.find((e) => e.primary && e.verified)
    primaryEmail = primary?.email ?? emails[0]?.email ?? null
  }

  return { id: String(user.id), login: user.login, name: user.name ?? user.login, email: primaryEmail }
}

module.exports = { getAuthUrl, exchangeCode, getUserInfo }
