// @system FeatureFlagRepo — admin-managed feature flags

const db = require('../../../lib/@system/PostgreSQL')

const FeatureFlagRepo = {
  async findAll({ category } = {}) {
    if (category) {
      return db.any(
        'SELECT * FROM feature_flags WHERE category = $1 ORDER BY category, key',
        [category]
      )
    }
    return db.any('SELECT * FROM feature_flags ORDER BY category, key')
  },

  async findByKey(key) {
    return db.oneOrNone('SELECT * FROM feature_flags WHERE key = $1', [key])
  },

  async isEnabled(key) {
    const flag = await db.oneOrNone('SELECT enabled FROM feature_flags WHERE key = $1', [key])
    return flag ? flag.enabled : false
  },

  async toggle(key, enabled, userId = null) {
    return db.oneOrNone(
      `UPDATE feature_flags
       SET enabled = $2, updated_by = $3, updated_at = now()
       WHERE key = $1
       RETURNING *`,
      [key, enabled, userId]
    )
  },

  async create({ key, label, description, category = 'general', enabled = false }) {
    return db.one(
      `INSERT INTO feature_flags (key, label, description, category, enabled)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [key, label, description, category, enabled]
    )
  },

  async delete(key) {
    return db.oneOrNone(
      'DELETE FROM feature_flags WHERE key = $1 RETURNING *',
      [key]
    )
  },

  async getCategories() {
    const rows = await db.any('SELECT DISTINCT category FROM feature_flags ORDER BY category')
    return rows.map(r => r.category)
  },
}

module.exports = FeatureFlagRepo
