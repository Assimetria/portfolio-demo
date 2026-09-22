// @system — Message repository (raw SQL / pg-promise)
const db = require('../../../lib/@system/PostgreSQL')

const MessageRepo = {
  async findByThreadId(threadId, { limit = 50, offset = 0 } = {}) {
    return db.any(
      'SELECT * FROM messages WHERE thread_id = $1 ORDER BY created_at ASC LIMIT $2 OFFSET $3',
      [threadId, limit, offset],
    )
  },

  async create({ thread_id, sender = 'user', content, metadata = {} }) {
    return db.one(
      `INSERT INTO messages (thread_id, sender, content, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [thread_id, sender, content, JSON.stringify(metadata)],
    )
  },

  async countByThreadId(threadId) {
    const row = await db.one(
      'SELECT COUNT(*)::int AS count FROM messages WHERE thread_id = $1',
      [threadId],
    )
    return row.count
  },
}

module.exports = MessageRepo
