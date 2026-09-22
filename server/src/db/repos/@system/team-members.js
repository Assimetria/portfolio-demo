/**
 * @system Team Members Repository
 * Data access layer for team_members table
 */

class TeamMembersRepository {
  constructor(db) {
    this.db = db
  }

  /**
   * Add member to team
   * @param {Object} data - Member data
   * @returns {Promise<Object>} Created team member
   */
  async create({ team_id, user_id, role = 'member', permissions = [] }) {
    const sql = `
      INSERT INTO team_members (team_id, user_id, role, permissions)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `
    return this.db.one(sql, [team_id, user_id, role, permissions])
  }

  /**
   * Find member by ID
   * @param {number} id - Member ID
   * @returns {Promise<Object|null>} Member or null
   */
  async findById(id) {
    const sql = `SELECT * FROM team_members WHERE id = $1`
    return this.db.oneOrNone(sql, [id])
  }

  /**
   * Find member by team and user ID
   * @param {number} team_id - Team ID
   * @param {number} user_id - User ID
   * @returns {Promise<Object|null>} Member or null
   */
  async findByTeamAndUser(team_id, user_id) {
    const sql = `SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2`
    return this.db.oneOrNone(sql, [team_id, user_id])
  }

  /**
   * Get all members of a team (with user details)
   * @param {number} team_id - Team ID
   * @returns {Promise<Array>} Array of members with user info
   */
  async findByTeamId(team_id) {
    const sql = `
      SELECT 
        tm.*,
        u.email,
        u.name,
        u.created_at as user_created_at
      FROM team_members tm
      INNER JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = $1
      ORDER BY tm.joined_at ASC
    `
    return this.db.any(sql, [team_id])
  }

  /**
   * Get all teams for a user (with team details)
   * @param {number} user_id - User ID
   * @returns {Promise<Array>} Array of memberships with team info
   */
  async findByUserId(user_id) {
    const sql = `
      SELECT 
        tm.*,
        t.name as team_name,
        t.slug as team_slug,
        t.owner_id as team_owner_id
      FROM team_members tm
      INNER JOIN teams t ON tm.team_id = t.id
      WHERE tm.user_id = $1
      ORDER BY tm.joined_at DESC
    `
    return this.db.any(sql, [user_id])
  }

  /**
   * Update member role and permissions
   * @param {number} team_id - Team ID
   * @param {number} user_id - User ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated member
   */
  async update(team_id, user_id, { role, permissions }) {
    const updates = []
    const values = []
    let paramCount = 1

    if (role !== undefined) {
      updates.push(`role = $${paramCount++}`)
      values.push(role)
    }
    if (permissions !== undefined) {
      updates.push(`permissions = $${paramCount++}`)
      values.push(permissions)
    }
    updates.push(`updated_at = now()`)
    values.push(team_id, user_id)

    const sql = `
      UPDATE team_members 
      SET ${updates.join(', ')}
      WHERE team_id = $${paramCount} AND user_id = $${paramCount + 1}
      RETURNING *
    `
    return this.db.one(sql, values)
  }

  /**
   * Remove member from team
   * @param {number} team_id - Team ID
   * @param {number} user_id - User ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(team_id, user_id) {
    const sql = `DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`
    const result = await this.db.result(sql, [team_id, user_id])
    return result.rowCount > 0
  }

  /**
   * Check if user is member of team
   * @param {number} team_id - Team ID
   * @param {number} user_id - User ID
   * @returns {Promise<boolean>} Is member
   */
  async isMember(team_id, user_id) {
    const sql = `SELECT EXISTS(SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2) as exists`
    const result = await this.db.one(sql, [team_id, user_id])
    return result.exists
  }

  /**
   * Check if user has specific role in team
   * @param {number} team_id - Team ID
   * @param {number} user_id - User ID
   * @param {string|Array} roles - Role or array of roles to check
   * @returns {Promise<boolean>} Has role
   */
  async hasRole(team_id, user_id, roles) {
    const roleArray = Array.isArray(roles) ? roles : [roles]
    const sql = `
      SELECT EXISTS(
        SELECT 1 FROM team_members 
        WHERE team_id = $1 AND user_id = $2 AND role = ANY($3)
      ) as exists
    `
    const result = await this.db.one(sql, [team_id, user_id, roleArray])
    return result.exists
  }

  /**
   * Get member count by role
   * @param {number} team_id - Team ID
   * @returns {Promise<Object>} Count by role
   */
  async getCountByRole(team_id) {
    const sql = `
      SELECT role, COUNT(*) as count
      FROM team_members
      WHERE team_id = $1
      GROUP BY role
    `
    const results = await this.db.any(sql, [team_id])
    return results.reduce((acc, { role, count }) => {
      acc[role] = parseInt(count, 10)
      return acc
    }, {})
  }
}

module.exports = TeamMembersRepository
