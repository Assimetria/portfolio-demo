/**
 * @system — OAuthRepo
 *
 * Data-access helpers for the oauth_accounts table.
 */

const db = require('../../../lib/@system/PostgreSQL')

const OAuthRepo = {
  /**
   * Find the user linked to a specific OAuth provider + provider_id.
   * Returns the user row (from users table) or null.
   */
  async findUserByProvider(provider, providerId) {
    return db.oneOrNone(
      `SELECT u.*
       FROM users u
       JOIN oauth_accounts oa ON oa.user_id = u.id
       WHERE oa.provider = $1 AND oa.provider_id = $2`,
      [provider, String(providerId)],
    )
  },

  /**
   * Insert a new oauth_accounts row linking a user to a provider identity.
   * Ignores conflicts (idempotent — safe to call on every login).
   */
  async linkProvider({ userId, provider, providerId, email }) {
    return db.none(
      `INSERT INTO oauth_accounts (user_id, provider, provider_id, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (provider, provider_id) DO NOTHING`,
      [userId, provider, String(providerId), email ?? null],
    )
  },

  /**
   * List all OAuth identities linked to a user.
   */
  async listByUser(userId) {
    return db.any(
      `SELECT id, provider, provider_id, email, created_at
       FROM oauth_accounts
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [userId],
    )
  },

  /**
   * Unlink a specific OAuth identity from a user (returns number of deleted rows).
   */
  async unlink({ userId, provider }) {
    const result = await db.result(
      `DELETE FROM oauth_accounts WHERE user_id = $1 AND provider = $2`,
      [userId, provider],
    )
    return result.rowCount
  },
}

module.exports = OAuthRepo
