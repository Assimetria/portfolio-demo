// @system — Thread repository (raw SQL / pg-promise)
const db = require('../../../lib/@system/PostgreSQL')

const ThreadRepo = {
  async findById(id) {
    return db.oneOrNone('SELECT * FROM threads WHERE id = $1', [id])
  },

  async findByUserId(userId, { limit = 20, offset = 0 } = {}) {
    return db.any(
      'SELECT * FROM threads WHERE user_id = $1 ORDER BY last_message_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset],
    )
  },

  async create({ user_id, title = 'New Chat', external_id = null }) {
    return db.one(
      `INSERT INTO threads (user_id, title, external_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [user_id, title, external_id],
    )
  },

  async updateLastMessageTime(id) {
    return db.oneOrNone(
      'UPDATE threads SET last_message_at = now() WHERE id = $1 RETURNING *',
      [id],
    )
  },

  async updateTitle(id, userId, title) {
    return db.oneOrNone(
      'UPDATE threads SET title = $3 WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId, title],
    )
  },

  async delete(id, userId) {
    return db.result(
      'DELETE FROM threads WHERE id = $1 AND user_id = $2',
      [id, userId],
    )
  },
}

module.exports = ThreadRepo
