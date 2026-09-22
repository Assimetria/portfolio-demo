/**
 * @system Team Invitations Repository
 * Data access layer for team_invitations table
 */

const crypto = require('crypto')

class TeamInvitationsRepository {
  constructor(db) {
    this.db = db
  }

  /**
   * Create a team invitation
   * @param {Object} data - Invitation data
   * @returns {Promise<Object>} Created invitation
   */
  async create({ team_id, email, role = 'member', permissions = [], invited_by, expiresInDays = 7 }) {
    const token = crypto.randomBytes(32).toString('hex')
    const expires_at = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)

    const sql = `
      INSERT INTO team_invitations (team_id, email, role, permissions, invited_by, token, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `
    return this.db.one(sql, [team_id, email, role, permissions, invited_by, token, expires_at])
  }

  /**
   * Find invitation by ID
   * @param {number} id - Invitation ID
   * @returns {Promise<Object|null>} Invitation or null
   */
  async findById(id) {
    const sql = `SELECT * FROM team_invitations WHERE id = $1`
    return this.db.oneOrNone(sql, [id])
  }

  /**
   * Find invitation by token
   * @param {string} token - Invitation token
   * @returns {Promise<Object|null>} Invitation or null
   */
  async findByToken(token) {
    const sql = `
      SELECT ti.*, t.name as team_name, t.slug as team_slug
      FROM team_invitations ti
      INNER JOIN teams t ON ti.team_id = t.id
      WHERE ti.token = $1
    `
    return this.db.oneOrNone(sql, [token])
  }

  /**
   * Find all invitations for a team
   * @param {number} team_id - Team ID
   * @param {boolean} includeExpired - Include expired invitations
   * @returns {Promise<Array>} Array of invitations
   */
  async findByTeamId(team_id, includeExpired = false) {
    const expiredCondition = includeExpired ? '' : 'AND ti.expires_at > now() AND ti.accepted_at IS NULL'
    
    const sql = `
      SELECT 
        ti.*,
        u.name as inviter_name,
        u.email as inviter_email
      FROM team_invitations ti
      INNER JOIN users u ON ti.invited_by = u.id
      WHERE ti.team_id = $1 ${expiredCondition}
      ORDER BY ti.created_at DESC
    `
    return this.db.any(sql, [team_id])
  }

  /**
   * Find pending invitations for an email
   * @param {string} email - Email address
   * @returns {Promise<Array>} Array of pending invitations
   */
  async findPendingByEmail(email) {
    const sql = `
      SELECT 
        ti.*,
        t.name as team_name,
        t.slug as team_slug,
        u.name as inviter_name
      FROM team_invitations ti
      INNER JOIN teams t ON ti.team_id = t.id
      INNER JOIN users u ON ti.invited_by = u.id
      WHERE ti.email = $1 
        AND ti.accepted_at IS NULL
        AND ti.expires_at > now()
      ORDER BY ti.created_at DESC
    `
    return this.db.any(sql, [email])
  }

  /**
   * Accept invitation
   * @param {string} token - Invitation token
   * @param {number} user_id - User ID accepting the invitation
   * @returns {Promise<Object>} Updated invitation
   */
  async accept(token, user_id) {
    const sql = `
      UPDATE team_invitations
      SET accepted_at = now(), accepted_by = $2, updated_at = now()
      WHERE token = $1 AND accepted_at IS NULL AND expires_at > now()
      RETURNING *
    `
    return this.db.oneOrNone(sql, [token, user_id])
  }

  /**
   * Revoke invitation
   * @param {number} id - Invitation ID
   * @returns {Promise<boolean>} Success status
   */
  async revoke(id) {
    const sql = `DELETE FROM team_invitations WHERE id = $1 AND accepted_at IS NULL`
    const result = await this.db.result(sql, [id])
    return result.rowCount > 0
  }

  /**
   * Check if invitation is valid
   * @param {string} token - Invitation token
   * @returns {Promise<boolean>} Is valid
   */
  async isValid(token) {
    const sql = `
      SELECT EXISTS(
        SELECT 1 FROM team_invitations 
        WHERE token = $1 
          AND accepted_at IS NULL 
          AND expires_at > now()
      ) as exists
    `
    const result = await this.db.one(sql, [token])
    return result.exists
  }

  /**
   * Clean up expired invitations
   * @returns {Promise<number>} Number of deleted invitations
   */
  async cleanupExpired() {
    const sql = `
      DELETE FROM team_invitations 
      WHERE expires_at < now() 
        AND accepted_at IS NULL
    `
    const result = await this.db.result(sql)
    return result.rowCount
  }

  /**
   * Resend invitation (creates new token with new expiry)
   * @param {number} id - Invitation ID
   * @param {number} expiresInDays - Expiry in days
   * @returns {Promise<Object>} Updated invitation
   */
  async resend(id, expiresInDays = 7) {
    const token = crypto.randomBytes(32).toString('hex')
    const expires_at = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)

    const sql = `
      UPDATE team_invitations
      SET token = $2, expires_at = $3, updated_at = now()
      WHERE id = $1 AND accepted_at IS NULL
      RETURNING *
    `
    return this.db.oneOrNone(sql, [id, token, expires_at])
  }
}

module.exports = TeamInvitationsRepository
