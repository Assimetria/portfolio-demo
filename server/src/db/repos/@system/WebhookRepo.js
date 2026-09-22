const db = require('../../../lib/@system/PostgreSQL')

const WebhookRepo = {
  async findAllByUser(userId) {
    return db.any(
      `SELECT id, user_id, url, events, description, active, created_at, updated_at
       FROM webhooks
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    )
  },

  async findById(id, userId) {
    return db.oneOrNone(
      'SELECT * FROM webhooks WHERE id = $1 AND user_id = $2',
      [id, userId],
    )
  },

  async findActiveByEvent(event) {
    return db.any(
      `SELECT * FROM webhooks
       WHERE active = true
         AND (events @> $1::jsonb OR events @> '"*"'::jsonb)`,
      [JSON.stringify([event])],
    )
  },

  async create({ userId, url, events, secret, description }) {
    return db.one(
      `INSERT INTO webhooks (user_id, url, events, secret, description)
       VALUES ($1, $2, $3::jsonb, $4, $5)
       RETURNING id, user_id, url, events, description, active, created_at`,
      [userId, url, JSON.stringify(events), secret, description ?? null],
    )
  },

  async update(id, userId, { url, events, description, active }) {
    const sets = []
    const params = [id, userId]
    let idx = 3

    if (url !== undefined) { sets.push(`url = $${idx++}`); params.push(url) }
    if (events !== undefined) { sets.push(`events = $${idx++}::jsonb`); params.push(JSON.stringify(events)) }
    if (description !== undefined) { sets.push(`description = $${idx++}`); params.push(description) }
    if (active !== undefined) { sets.push(`active = $${idx++}`); params.push(active) }

    if (sets.length === 0) return null

    sets.push('updated_at = now()')

    const result = await db.result(
      `UPDATE webhooks SET ${sets.join(', ')} WHERE id = $1 AND user_id = $2`,
      params,
    )
    return result.rowCount > 0
  },

  async deleteById(id, userId) {
    const result = await db.result(
      'DELETE FROM webhooks WHERE id = $1 AND user_id = $2',
      [id, userId],
    )
    return result.rowCount > 0
  },

  async logDelivery({ webhookId, event, payload, status, response, durationMs }) {
    return db.none(
      `INSERT INTO webhook_deliveries (webhook_id, event, payload, status, response, duration_ms)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6)`,
      [webhookId, event, JSON.stringify(payload), status ?? null, response ?? null, durationMs ?? null],
    )
  },

  async getDeliveries(webhookId, userId, { limit = 20 } = {}) {
    return db.any(
      `SELECT wd.* FROM webhook_deliveries wd
       JOIN webhooks w ON w.id = wd.webhook_id
       WHERE wd.webhook_id = $1 AND w.user_id = $2
       ORDER BY wd.created_at DESC
       LIMIT $3`,
      [webhookId, userId, limit],
    )
  },
}

module.exports = WebhookRepo
