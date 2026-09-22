// @system — Subscription repository (raw SQL / pg-promise)
// Supports the full Simtria billing model: Stripe external IDs, plan info,
// periodicity, UTM tracking, cancellation metadata, and credit-worthy detection.
const db = require('../../../lib/@system/PostgreSQL')

const SubscriptionRepo = {
  async findById(id) {
    return db.oneOrNone('SELECT * FROM subscriptions WHERE id = $1', [id])
  },

  async findByUserId(userId) {
    return db.any('SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC', [userId])
  },

  async findActiveByUserId(userId) {
    return db.oneOrNone(
      "SELECT * FROM subscriptions WHERE user_id = $1 AND status IN ('active', 'trialing') ORDER BY created_at DESC LIMIT 1",
      [userId],
    )
  },

  async findAllActiveByUserId(userId) {
    return db.any(
      "SELECT * FROM subscriptions WHERE user_id = $1 AND status IN ('active', 'trialing') ORDER BY created_at DESC",
      [userId],
    )
  },

  async findByStripeSubscriptionId(stripeSubscriptionId) {
    return db.oneOrNone('SELECT * FROM subscriptions WHERE stripe_subscription_id = $1', [stripeSubscriptionId])
  },

  async findByExternalId(externalId) {
    // Alias for findByStripeSubscriptionId — matches Simtria's naming
    return this.findByStripeSubscriptionId(externalId)
  },

  async findByStripeCustomerId(stripeCustomerId) {
    return db.oneOrNone(
      'SELECT * FROM subscriptions WHERE stripe_customer_id = $1 ORDER BY created_at DESC LIMIT 1',
      [stripeCustomerId],
    )
  },

  async create({
    user_id,
    stripe_subscription_id,
    stripe_customer_id,
    stripe_price_id,
    status = 'inactive',
    plan = null,
    price = 0,
    periodicity = null,
    current_period_start,
    current_period_end,
    cancel_at_period_end = false,
    brand_id = null,
    utm_source = null,
    referrer = null,
    last_renew = null,
    payment_provider = 'stripe',
    metadata = {},
  }) {
    return db.one(
      `INSERT INTO subscriptions
         (user_id, stripe_subscription_id, stripe_customer_id, stripe_price_id,
          status, plan, price, periodicity, current_period_start, current_period_end,
          cancel_at_period_end, brand_id, utm_source, referrer, last_renew,
          payment_provider, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
      [
        user_id, stripe_subscription_id, stripe_customer_id, stripe_price_id,
        status, plan, price, periodicity, current_period_start, current_period_end,
        cancel_at_period_end, brand_id, utm_source, referrer, last_renew,
        payment_provider, JSON.stringify(metadata),
      ],
    )
  },

  async update(id, fields) {
    const allowed = [
      'stripe_subscription_id', 'stripe_customer_id', 'stripe_price_id',
      'status', 'plan', 'price', 'periodicity',
      'current_period_start', 'current_period_end', 'cancel_at_period_end',
      'brand_id', 'utm_source', 'referrer', 'last_renew',
      'payment_provider', 'metadata',
    ]
    const entries = Object.entries(fields).filter(([k, v]) => allowed.includes(k) && v !== undefined)
    if (!entries.length) return this.findById(id)

    const sets = entries.map(([k], i) => {
      if (k === 'metadata') return `${k} = $${i + 2}::jsonb`
      return `${k} = $${i + 2}`
    }).join(', ')
    const values = entries.map(([k, v]) => k === 'metadata' ? JSON.stringify(v) : v)

    return db.one(
      `UPDATE subscriptions SET ${sets}, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, ...values],
    )
  },

  async updateByExternalId(externalId, fields) {
    const sub = await this.findByStripeSubscriptionId(externalId)
    if (!sub) return null
    return this.update(sub.id, fields)
  },

  async upsertByStripeSubscriptionId(data) {
    const existing = await this.findByStripeSubscriptionId(data.stripe_subscription_id)
    if (existing) {
      const { user_id, stripe_subscription_id, ...updateFields } = data
      return this.update(existing.id, updateFields)
    }
    return this.create(data)
  },

  async updateStatus(id, status) {
    return db.oneOrNone(
      'UPDATE subscriptions SET status = $2, updated_at = now() WHERE id = $1 RETURNING *',
      [id, status],
    )
  },

  async findCanceledSubscriptions() {
    return db.any("SELECT * FROM subscriptions WHERE status = 'canceled' ORDER BY updated_at DESC")
  },

  async deleteByUserId(userId) {
    return db.result('DELETE FROM subscriptions WHERE user_id = $1', [userId])
  },

  // ── Admin / Metrics queries ──────────────────────────────────────────────

  async countByStatus() {
    return db.any('SELECT status, COUNT(*)::int AS count FROM subscriptions GROUP BY status')
  },

  async findActiveWithRevenue() {
    return db.any(
      `SELECT * FROM subscriptions
       WHERE status = 'active'
         AND stripe_subscription_id IS NOT NULL
         AND (current_period_end IS NULL OR current_period_end > now())
       ORDER BY created_at DESC`,
    )
  },

  async findNewInDateRange(startDate, endDate) {
    return db.any(
      `SELECT * FROM subscriptions
       WHERE status = 'active'
         AND stripe_subscription_id IS NOT NULL
         AND created_at >= $1 AND created_at < $2
       ORDER BY created_at DESC`,
      [startDate, endDate],
    )
  },

  async findCanceledInDateRange(startDate, endDate) {
    return db.any(
      `SELECT * FROM subscriptions
       WHERE status = 'canceled'
         AND stripe_subscription_id IS NOT NULL
         AND updated_at >= $1 AND updated_at < $2
       ORDER BY updated_at DESC`,
      [startDate, endDate],
    )
  },
}

module.exports = SubscriptionRepo
