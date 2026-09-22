/**
 * @system Team Activity Log Repository
 * Data access layer for team_activity_log table
 */

class TeamActivityLogRepository {
  constructor(db) {
    this.db = db
  }

  /**
   * Log an activity
   * @param {Object} data - Activity data
   * @returns {Promise<Object>} Created log entry
   */
  async log({ team_id, user_id, action, details = {}, ip_address = null, user_agent = null }) {
    const sql = `
      INSERT INTO team_activity_log (team_id, user_id, action, details, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `
    return this.db.one(sql, [team_id, user_id, action, details, ip_address, user_agent])
  }

  /**
   * Get activity log for a team
   * @param {number} team_id - Team ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Activity log and total count
   */
  async findByTeamId(team_id, { limit = 50, offset = 0, action = null, user_id = null }) {
    let whereConditions = ['team_id = $1']
    let values = [team_id]
    let paramCount = 2

    if (action) {
      whereConditions.push(`action = $${paramCount}`)
      values.push(action)
      paramCount++
    }

    if (user_id) {
      whereConditions.push(`user_id = $${paramCount}`)
      values.push(user_id)
      paramCount++
    }

    const whereClause = whereConditions.join(' AND ')

    const countSql = `SELECT COUNT(*) as total FROM team_activity_log WHERE ${whereClause}`
    const dataSql = `
      SELECT 
        tal.*,
        u.name as user_name,
        u.email as user_email
      FROM team_activity_log tal
      LEFT JOIN users u ON tal.user_id = u.id
      WHERE ${whereClause}
      ORDER BY tal.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `

    values.push(limit, offset)

    const [{ total }, activities] = await Promise.all([
      this.db.one(countSql, values.slice(0, -2)),
      this.db.any(dataSql, values)
    ])

    return {
      activities,
      total: parseInt(total, 10),
      limit,
      offset
    }
  }

  /**
   * Get activity log for a user across all teams
   * @param {number} user_id - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Activity log and total count
   */
  async findByUserId(user_id, { limit = 50, offset = 0 }) {
    const countSql = `SELECT COUNT(*) as total FROM team_activity_log WHERE user_id = $1`
    const dataSql = `
      SELECT 
        tal.*,
        t.name as team_name,
        t.slug as team_slug
      FROM team_activity_log tal
      INNER JOIN teams t ON tal.team_id = t.id
      WHERE tal.user_id = $1
      ORDER BY tal.created_at DESC
      LIMIT $2 OFFSET $3
    `

    const [{ total }, activities] = await Promise.all([
      this.db.one(countSql, [user_id]),
      this.db.any(dataSql, [user_id, limit, offset])
    ])

    return {
      activities,
      total: parseInt(total, 10),
      limit,
      offset
    }
  }

  /**
   * Get recent activities for a team
   * @param {number} team_id - Team ID
   * @param {number} limit - Number of activities to fetch
   * @returns {Promise<Array>} Recent activities
   */
  async getRecent(team_id, limit = 10) {
    const sql = `
      SELECT 
        tal.*,
        u.name as user_name,
        u.email as user_email
      FROM team_activity_log tal
      LEFT JOIN users u ON tal.user_id = u.id
      WHERE tal.team_id = $1
      ORDER BY tal.created_at DESC
      LIMIT $2
    `
    return this.db.any(sql, [team_id, limit])
  }

  /**
   * Delete old activity logs (for cleanup/GDPR)
   * @param {number} daysOld - Delete logs older than this many days
   * @returns {Promise<number>} Number of deleted records
   */
  async deleteOldLogs(daysOld = 90) {
    const sql = `
      DELETE FROM team_activity_log 
      WHERE created_at < now() - interval '${daysOld} days'
    `
    const result = await this.db.result(sql)
    return result.rowCount
  }
}

module.exports = TeamActivityLogRepository
