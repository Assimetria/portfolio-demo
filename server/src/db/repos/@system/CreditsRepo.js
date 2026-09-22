// @system — Credits repository (raw SQL / pg-promise)
const db = require('../../../lib/@system/PostgreSQL')

const CreditsRepo = {
  async findById(id) {
    return db.oneOrNone('SELECT * FROM credits WHERE id = $1', [id])
  },

  async findByUserId(userId) {
    return db.oneOrNone('SELECT * FROM credits WHERE user_id = $1', [userId])
  },

  async create({ user_id, amount = 0, metadata = {} }) {
    return db.one(
      `INSERT INTO credits (user_id, amount, metadata)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [user_id, amount, JSON.stringify(metadata)],
    )
  },

  async addCredits(userId, amount, metadata = {}) {
    // Atomic increment — avoids race conditions
    return db.oneOrNone(
      `UPDATE credits
       SET amount = amount + $2, metadata = metadata || $3::jsonb, updated_at = now()
       WHERE user_id = $1
       RETURNING *`,
      [userId, amount, JSON.stringify(metadata)],
    )
  },

  async deductCredits(userId, amount) {
    return db.oneOrNone(
      `UPDATE credits
       SET amount = GREATEST(amount - $2, 0), updated_at = now()
       WHERE user_id = $1
       RETURNING *`,
      [userId, amount],
    )
  },

  async setCredits(userId, amount) {
    return db.oneOrNone(
      `UPDATE credits SET amount = $2, updated_at = now() WHERE user_id = $1 RETURNING *`,
      [userId, amount],
    )
  },

  async ensureCreditsExist(userId, initialAmount = 0) {
    // Insert if not exists, return existing if already present
    return db.one(
      `INSERT INTO credits (user_id, amount)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
       RETURNING *`,
      [userId, initialAmount],
    )
  },
}

module.exports = CreditsRepo
