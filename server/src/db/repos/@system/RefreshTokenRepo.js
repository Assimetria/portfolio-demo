const crypto = require('crypto')
const db = require('../../../lib/@system/PostgreSQL')

const REFRESH_TTL_DAYS = 7

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

const RefreshTokenRepo = {
  /**
   * Generate a cryptographically-random opaque refresh token and persist its hash.
   * Returns { token, record } — `token` is sent to the client, `record` is the DB row.
   */
  async create({ userId, familyId = null, ip = null, userAgent = null }) {
    const token = crypto.randomBytes(48).toString('hex')
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000)

    const query = familyId
      ? `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
         VALUES ($1, $2, $3, $4) RETURNING *`
      : `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3) RETURNING *`

    const params = familyId
      ? [userId, tokenHash, familyId, expiresAt]
      : [userId, tokenHash, expiresAt]

    const record = await db.one(query, params)
    return { token, record }
  },

  /**
   * Look up a token by its hash. Returns null if not found, expired, or revoked.
   */
  async findValid(token) {
    const tokenHash = hashToken(token)
    return db.oneOrNone(
      `SELECT * FROM refresh_tokens
       WHERE token_hash = $1
         AND revoked_at IS NULL
         AND expires_at > now()`,
      [tokenHash],
    )
  },

  /**
   * Look up by hash regardless of validity (used for reuse detection).
   */
  async findByHash(token) {
    const tokenHash = hashToken(token)
    return db.oneOrNone('SELECT * FROM refresh_tokens WHERE token_hash = $1', [tokenHash])
  },

  /**
   * Revoke a single token by its DB id.
   */
  async revokeById(id, { replacedBy = null } = {}) {
    return db.none(
      `UPDATE refresh_tokens
       SET revoked_at = now(), replaced_by = $2
       WHERE id = $1`,
      [id, replacedBy],
    )
  },

  /**
   * Revoke all tokens belonging to a family (reuse-attack response).
   */
  async revokeFamilyById(familyId) {
    return db.none(
      `UPDATE refresh_tokens
       SET revoked_at = now()
       WHERE family_id = $1 AND revoked_at IS NULL`,
      [familyId],
    )
  },

  /**
   * Revoke all active refresh tokens for a user (global logout).
   */
  async revokeAllForUser(userId) {
    return db.none(
      `UPDATE refresh_tokens
       SET revoked_at = now()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    )
  },

  /**
   * Revoke by a pre-hashed token_hash value (used when we only have the hash,
   * e.g. when revoking a session from the sessions table).
   */
  async revokeByTokenHashDirect(tokenHash) {
    return db.none(
      `UPDATE refresh_tokens SET revoked_at = now()
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash],
    )
  },

  /**
   * Rotate: revoke the old token, issue a new one in the same family.
   * Returns { token, record } for the new token.
   */
  async rotate(oldRecord) {
    const { token: newToken, record: newRecord } = await this.create({
      userId: oldRecord.user_id,
      familyId: oldRecord.family_id,
    })
    await this.revokeById(oldRecord.id, { replacedBy: newRecord.id })
    return { token: newToken, record: newRecord }
  },
}

module.exports = RefreshTokenRepo
