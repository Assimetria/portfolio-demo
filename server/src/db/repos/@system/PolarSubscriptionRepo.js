// @system — Polar subscription repository
const db = require('../../../lib/@system/PostgreSQL')

const PolarSubscriptionRepo = {
  async findById(id) {
    return db.oneOrNone('SELECT * FROM polar_subscriptions WHERE id = $1', [id])
  },

  async findByUserId(userId) {
    return db.any(
      'SELECT * FROM polar_subscriptions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    )
  },

  async findActiveByUserId(userId) {
    return db.oneOrNone(
      "SELECT * FROM polar_subscriptions WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1",
      [userId],
    )
  },

  async findByPolarSubscriptionId(polarSubscriptionId) {
    return db.oneOrNone(
      'SELECT * FROM polar_subscriptions WHERE polar_subscription_id = $1',
      [polarSubscriptionId],
    )
  },

  async create({
    user_id,
    polar_subscription_id,
    polar_product_id,
    polar_price_id,
    status = 'inactive',
    current_period_start,
    current_period_end,
    cancel_at_period_end = false,
  }) {
    return db.one(
      `INSERT INTO polar_subscriptions
         (user_id, polar_subscription_id, polar_product_id, polar_price_id,
          status, current_period_start, current_period_end, cancel_at_period_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        user_id,
        polar_subscription_id,
        polar_product_id,
        polar_price_id,
        status,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
      ],
    )
  },

  async update(id, fields) {
    const allowed = [
      'polar_product_id',
      'polar_price_id',
      'status',
      'current_period_start',
      'current_period_end',
      'cancel_at_period_end',
    ]
    const entries = Object.entries(fields).filter(
      ([k, v]) => allowed.includes(k) && v !== undefined,
    )
    if (!entries.length) return this.findById(id)
    const sets = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ')
    const values = entries.map(([, v]) => v)
    return db.one(
      `UPDATE polar_subscriptions SET ${sets}, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, ...values],
    )
  },

  async upsertByPolarSubscriptionId({
    user_id,
    polar_subscription_id,
    polar_product_id,
    polar_price_id,
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
  }) {
    const existing = await this.findByPolarSubscriptionId(polar_subscription_id)
    if (existing) {
      return this.update(existing.id, {
        polar_product_id,
        polar_price_id,
        status,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
      })
    }
    return this.create({
      user_id,
      polar_subscription_id,
      polar_product_id,
      polar_price_id,
      status,
      current_period_start,
      current_period_end,
      cancel_at_period_end,
    })
  },

  async updateStatus(id, status) {
    return db.oneOrNone(
      'UPDATE polar_subscriptions SET status = $2, updated_at = now() WHERE id = $1 RETURNING *',
      [id, status],
    )
  },

  async deleteByUserId(userId) {
    return db.result('DELETE FROM polar_subscriptions WHERE user_id = $1', [userId])
  },
}

module.exports = PolarSubscriptionRepo
