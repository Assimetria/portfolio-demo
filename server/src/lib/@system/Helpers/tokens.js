// @system — token generation utilities
// Per Protocol #21: auth-adjacent logic (token generation) belongs in @system.
// @custom routes must import from here rather than calling crypto directly.

const crypto = require('crypto')

/**
 * Generate a cryptographically secure invite token.
 * Returns a 64-character hex string (32 random bytes).
 */
function generateInviteToken() {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * SHA-256 hash a raw token string.
 * Single source of truth — used by auth, sessions, and RefreshTokenRepo.
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

module.exports = { generateInviteToken, hashToken }
