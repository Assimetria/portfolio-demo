/**
 * @system Teams Repository
 * Data access layer for teams table
 */

class TeamsRepository {
  constructor(db) {
    this.db = db
  }

  /**
   * Create a new team
   * @param {Object} data - Team data
   * @returns {Promise<Object>} Created team
   */
  async create({ name, slug, description, owner_id, settings = {} }) {
    const sql = `
      INSERT INTO teams (name, slug, description, owner_id, settings)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `
    return this.db.one(sql, [name, slug, description, owner_id, settings])
  }

  /**
   * Find team by ID
   * @param {number} id - Team ID
   * @returns {Promise<Object|null>} Team or null
   */
  async findById(id) {
    const sql = `SELECT * FROM teams WHERE id = $1`
    return this.db.oneOrNone(sql, [id])
  }

  /**
   * Find team by slug
   * @param {string} slug - Team slug
   * @returns {Promise<Object|null>} Team or null
   */
  async findBySlug(slug) {
    const sql = `SELECT * FROM teams WHERE slug = $1`
    return this.db.oneOrNone(sql, [slug])
  }

  /**
   * Find teams by owner ID
   * @param {number} owner_id - Owner user ID
   * @returns {Promise<Array>} Array of teams
   */
  async findByOwnerId(owner_id) {
    const sql = `
      SELECT * FROM teams 
      WHERE owner_id = $1 
      ORDER BY created_at DESC
    `
    return this.db.any(sql, [owner_id])
  }

  /**
   * Find teams where user is a member
   * @param {number} user_id - User ID
   * @returns {Promise<Array>} Array of teams with member info
   */
  async findByMemberId(user_id) {
    const sql = `
      SELECT t.*, tm.role, tm.permissions, tm.joined_at
      FROM teams t
      INNER JOIN team_members tm ON t.id = tm.team_id
      WHERE tm.user_id = $1
      ORDER BY tm.joined_at DESC
    `
    return this.db.any(sql, [user_id])
  }

  /**
   * Update team
   * @param {number} id - Team ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated team
   */
  async update(id, { name, description, settings }) {
    const updates = []
    const values = []
    let paramCount = 1

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`)
      values.push(name)
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`)
      values.push(description)
    }
    if (settings !== undefined) {
      updates.push(`settings = $${paramCount++}`)
      values.push(settings)
    }
    updates.push(`updated_at = now()`)
    values.push(id)

    const sql = `
      UPDATE teams 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `
    return this.db.one(sql, values)
  }

  /**
   * Delete team
   * @param {number} id - Team ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(id) {
    const sql = `DELETE FROM teams WHERE id = $1`
    const result = await this.db.result(sql, [id])
    return result.rowCount > 0
  }

  /**
   * Get team member count
   * @param {number} team_id - Team ID
   * @returns {Promise<number>} Member count
   */
  async getMemberCount(team_id) {
    const sql = `SELECT COUNT(*) as count FROM team_members WHERE team_id = $1`
    const result = await this.db.one(sql, [team_id])
    return parseInt(result.count, 10)
  }

  /**
   * List teams with pagination
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Teams and total count
   */
  async list({ limit = 20, offset = 0, search = null, owner_id = null }) {
    let whereConditions = []
    let values = []
    let paramCount = 1

    if (search) {
      whereConditions.push(`(name ILIKE $${paramCount} OR description ILIKE $${paramCount})`)
      values.push(`%${search}%`)
      paramCount++
    }

    if (owner_id) {
      whereConditions.push(`owner_id = $${paramCount}`)
      values.push(owner_id)
      paramCount++
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : ''

    const countSql = `SELECT COUNT(*) as total FROM teams ${whereClause}`
    const dataSql = `
      SELECT t.*, 
        (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count
      FROM teams t
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `

    values.push(limit, offset)

    const [{ total }, teams] = await Promise.all([
      this.db.one(countSql, values.slice(0, -2)),
      this.db.any(dataSql, values)
    ])

    return {
      teams,
      total: parseInt(total, 10),
      limit,
      offset
    }
  }
}

module.exports = TeamsRepository
