// Shared cookie helpers — used by auth/index.js and sessions/index.js
// secure flag is env-aware: HTTPS-only in production, plain HTTP allowed in dev

const IS_PROD = process.env.NODE_ENV === 'production'

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000           // 15 minutes
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// "Remember me" extends refresh token from 7 days → 30 days
const REMEMBER_ME_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

function setAccessCookie(res, token) {
  res.cookie('access_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: ACCESS_TOKEN_TTL_MS,
    path: '/',
  })
}

function setRefreshCookie(res, token, { rememberMe = false } = {}) {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: rememberMe ? REMEMBER_ME_REFRESH_TTL_MS : REFRESH_TOKEN_TTL_MS,
    path: '/api/sessions', // scoped: only sent to token-rotation endpoint
  })
}

module.exports = { setAccessCookie, setRefreshCookie, ACCESS_TOKEN_TTL_MS, REFRESH_TOKEN_TTL_MS, REMEMBER_ME_REFRESH_TTL_MS }
