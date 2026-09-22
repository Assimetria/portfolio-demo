/**
 * API Template - Repository Interface Reference
 *
 * This is a REFERENCE template describing the methods that a resource
 * repository should implement to work with the CRUD helpers in
 * ../../lib/@system/Helpers.
 *
 * All code is commented out because it references example resources. Copy
 * this pattern into `server/src/db/repos/@custom/YourResourceRepo.js` and
 * replace `resources` / `ResourceRepo` with your resource name.
 */

// ═══════════════════════════════════════════════════════════════════════════
// REPOSITORY INTERFACE
// ═══════════════════════════════════════════════════════════════════════════
/*
Your ResourceRepo should implement these methods:

class ResourceRepo {
  // Required for LIST
  async findAll({ whereClause, params, orderBy, limit, offset }) {
    const { sql } = buildSelect('resources', {
      whereClause,
      whereParams: params,
      orderBy,
      limit,
      offset,
    })
    const result = await db.query(sql, params)
    return result.rows
  }

  // Required for LIST
  async count({ whereClause, params }) {
    const { sql } = buildCount('resources', {
      whereClause,
      whereParams: params,
    })
    const result = await db.query(sql, params)
    return parseInt(result.rows[0].count, 10)
  }

  // Required for GET
  async findById(id) {
    const result = await db.query('SELECT * FROM resources WHERE id = $1', [id])
    return result.rows[0] || null
  }

  // Required for CREATE
  async create(data) {
    const { sql, params } = buildInsert('resources', data, { returning: true })
    const result = await db.query(sql, params)
    return result.rows[0]
  }

  // Required for UPDATE
  async update(id, data) {
    const { sql, params } = buildUpdate('resources', data, id, { returning: true })
    const result = await db.query(sql, params)
    return result.rows[0]
  }

  // Required for DELETE
  async delete(id) {
    await db.query('DELETE FROM resources WHERE id = $1', [id])
  }

  // Optional: Soft delete
  async softDelete(id) {
    await db.query('UPDATE resources SET deleted_at = NOW() WHERE id = $1', [id])
  }

  // Optional: Bulk operations
  async bulkDelete(ids) {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',')
    await db.query(`DELETE FROM resources WHERE id IN (${placeholders})`, ids)
  }

  // Optional: Custom methods
  async getStats(userId) {
    const result = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'published') as published,
        COUNT(*) FILTER (WHERE status = 'draft') as draft
      FROM resources
      WHERE user_id = $1
    `, [userId])
    return result.rows[0]
  }
}

module.exports = new ResourceRepo()
*/
