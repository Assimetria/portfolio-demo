// @system — Transaction repository (raw SQL / pg-promise)
const db = require('../../../lib/@system/PostgreSQL')

const TransactionRepo = {
  async findById(id) {
    return db.oneOrNone('SELECT * FROM transactions WHERE id = $1', [id])
  },

  async findByUserId(userId, { limit = 50, offset = 0 } = {}) {
    return db.any(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset],
    )
  },

  async findByExternalId(externalId) {
    return db.oneOrNone('SELECT * FROM transactions WHERE external_id = $1 ORDER BY created_at DESC LIMIT 1', [externalId])
  },

  async create({ user_id, amount = 1, type, credits = 0, price = 0, status = 'pending', description, external_id = null, metadata = {} }) {
    return db.one(
      `INSERT INTO transactions
         (user_id, amount, type, credits, price, status, description, external_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [user_id, amount, type, credits, price, status, description, external_id, JSON.stringify(metadata)],
    )
  },

  async updateStatus(id, status) {
    return db.oneOrNone(
      'UPDATE transactions SET status = $2, updated_at = now() WHERE id = $1 RETURNING *',
      [id, status],
    )
  },

  async findByDateRange(startDate, endDate, { type, status } = {}) {
    let query = 'SELECT * FROM transactions WHERE created_at >= $1 AND created_at < $2'
    const params = [startDate, endDate]
    if (type) {
      params.push(type)
      query += ` AND type = $${params.length}`
    }
    if (status) {
      params.push(status)
      query += ` AND status = $${params.length}`
    }
    query += ' ORDER BY created_at ASC'
    return db.any(query, params)
  },

  /**
   * Aggregate revenue by period (for admin financials)
   * @param {'day'|'week'|'month'} groupBy
   * @param {Date} since
   */
  async revenueByPeriod(groupBy = 'day', since = null) {
    const trunc = groupBy === 'week' ? 'week' : groupBy === 'month' ? 'month' : 'day'
    const sinceClause = since ? "AND created_at >= $1" : ''
    const params = since ? [since] : []
    return db.any(
      `SELECT date_trunc('${trunc}', created_at) AS period,
              SUM(price) AS total_revenue,
              COUNT(*) AS total_payments
       FROM transactions
       WHERE status = 'paid' ${sinceClause}
       GROUP BY period
       ORDER BY period ASC`,
      params,
    )
  },
}

module.exports = TransactionRepo
