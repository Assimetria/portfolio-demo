// @system — Notification repository (raw SQL / pg-promise)
// CRUD for in-app notifications (stored in notifications table).
const db = require('../../../lib/@system/PostgreSQL')

const NotificationRepo = {
  async findById(id) {
    return db.oneOrNone('SELECT * FROM notifications WHERE id = $1', [id])
  },

  async findByUserId(userId, { limit = 50, offset = 0, unreadOnly = false } = {}) {
    const filter = unreadOnly ? 'AND seen_at IS NULL' : ''
    return db.any(
      `SELECT * FROM notifications WHERE user_id = $1 ${filter} ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    )
  },

  async countUnread(userId) {
    const row = await db.one(
      'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND seen_at IS NULL',
      [userId],
    )
    return row.count
  },

  async create({ user_id, title, message, type = 'info' }) {
    return db.one(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [user_id, title, message, type],
    )
  },

  async markAsRead(id, userId) {
    return db.oneOrNone(
      'UPDATE notifications SET seen_at = now() WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId],
    )
  },

  async markAllAsRead(userId) {
    return db.result(
      'UPDATE notifications SET seen_at = now() WHERE user_id = $1 AND seen_at IS NULL',
      [userId],
    )
  },

  async deleteById(id, userId) {
    return db.result('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [id, userId])
  },

  async deleteAllRead(userId) {
    return db.result('DELETE FROM notifications WHERE user_id = $1 AND seen_at IS NOT NULL', [userId])
  },
}

module.exports = NotificationRepo
