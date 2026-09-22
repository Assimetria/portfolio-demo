// @system — StripeService: Full Stripe billing service (ported from Simtria)
// Handles webhook digestion, plan caching, payment/refund queries, tax extraction,
// discount codes, cancellation reason mapping, credit-worthy change detection.
// Uses raw SQL via pg-promise (NOT Sequelize).
//
// The class body here holds: constructor state, Stripe API wrappers, usage-based
// billing, discount codes, plan listing, period helpers, and private helpers.
// Webhook handlers live in ./webhooks.js and payment/refund/tax queries live in
// ./payments.js — both are mixed onto the prototype below so `this` is preserved.
'use strict'

const stripe = require('./index') // lazy-initialised Stripe SDK proxy
const logger = require('../Logger')
const webhookMethods = require('./webhooks')
const paymentMethods = require('./payments')

const CREDITS_MULTIPLIER = Number(process.env.CREDITS_MULTIPLIER) || 1

class StripeService {
  constructor() {
    this.endpointSecret = process.env.STRIPE_WEBHOOK_SECRET
    // Plan cache (24h TTL)
    this._planCache = { data: null, ts: null, ttl: 24 * 60 * 60 * 1000 }
  }

  // ── Cache helpers ────────────────────────────────────────────────────────

  _isCacheValid() {
    return this._planCache.data && this._planCache.ts && (Date.now() - this._planCache.ts) < this._planCache.ttl
  }

  // ── Stripe API wrappers ──────────────────────────────────────────────────

  async getCustomer(id) { return stripe.customers.retrieve(id) }
  async getPlan(id) { return stripe.plans.retrieve(id) }
  async getProduct(id) { return stripe.products.retrieve(id) }
  async getSubscription(id) { return stripe.subscriptions.retrieve(id) }
  async getInvoice(id) { return stripe.invoices.retrieve(id) }
  async getCoupon(id) { return stripe.coupons.retrieve(id) }
  async getCheckoutSession(id) { return stripe.checkout.sessions.retrieve(id) }

  async updateSubscription(id, data) { return stripe.subscriptions.update(id, data) }

  async getCustomerByEmail(email) {
    const customers = await stripe.customers.list({ email })
    return customers.data.length > 0 ? customers.data[0] : null
  }

  async getCustomerFromSubscription(subId) {
    const sub = await this.getSubscription(subId)
    return sub ? this.getCustomer(sub.customer) : null
  }

  async getCustomerSubscriptionsList(customerId, limit = 100) {
    try {
      const subs = await stripe.subscriptions.list({ customer: customerId, limit })
      return subs.data || []
    } catch (err) {
      logger.error({ err, customerId }, 'error fetching customer subscriptions')
      return []
    }
  }

  async cancelSubscription(subscriptionExternalId) {
    try {
      return await stripe.subscriptions.cancel(subscriptionExternalId)
    } catch (err) {
      throw new Error(`Error canceling subscription ${subscriptionExternalId}: ${err.message}`)
    }
  }

  async createCustomer(data) { return stripe.customers.create(data) }
  async createSubscription(data) { return stripe.subscriptions.create(data) }

  async listPaymentMethods(customerId) {
    const pm = await stripe.paymentMethods.list({ customer: customerId, type: 'card' })
    return pm.data
  }

  async updateSubscriptionPlan(subscriptionId, newPriceId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId)
    return stripe.subscriptions.update(subscriptionId, {
      items: [{ id: sub.items.data[0].id, price: newPriceId }],
      proration_behavior: 'create_prorations',
    })
  }

  // ── Usage-based billing ────────────────────────────────────────────────

  /**
   * Report metered usage for a subscription item.
   * Used for usage-based billing where charges are calculated per unit consumed.
   *
   * @param {string} subscriptionId - Stripe subscription ID
   * @param {number} quantity - Number of units to report
   * @param {string} [action='increment'] - 'increment' adds to current period, 'set' replaces
   * @param {number} [timestamp] - Unix timestamp (defaults to now)
   */
  async reportUsage(subscriptionId, quantity, action = 'increment', timestamp) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId)
    const meteredItem = sub.items.data.find(
      (item) => item.price?.recurring?.usage_type === 'metered'
    )
    if (!meteredItem) {
      throw new Error('No metered subscription item found on this subscription')
    }

    return stripe.subscriptionItems.createUsageRecord(meteredItem.id, {
      quantity,
      action,
      ...(timestamp ? { timestamp } : {}),
    })
  }

  /**
   * Get usage summary for a metered subscription item in the current billing period.
   */
  async getUsageSummary(subscriptionId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId)
    const meteredItem = sub.items.data.find(
      (item) => item.price?.recurring?.usage_type === 'metered'
    )
    if (!meteredItem) return null

    const summary = await stripe.subscriptionItems.listUsageRecordSummaries(meteredItem.id, {
      limit: 1,
    })
    return summary.data[0] || null
  }

  /**
   * Create a checkout session for a metered/usage-based price.
   * Metered prices cannot include a quantity at checkout time.
   */
  async createMeteredCheckout({ priceId, userId, email, trialDays, successUrl, cancelUrl }) {
    const params = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId }],
      success_url: successUrl || `${process.env.APP_URL}/app/billing?checkout=success`,
      cancel_url: cancelUrl || `${process.env.APP_URL}/pricing`,
      customer_email: email,
      client_reference_id: String(userId),
      metadata: { user_id: String(userId) },
    }

    if (trialDays && Number(trialDays) > 0) {
      params.subscription_data = {
        trial_period_days: Number(trialDays),
        metadata: { user_id: String(userId) },
      }
    }

    return stripe.checkout.sessions.create(params)
  }

  // ── Discount code application ────────────────────────────────────────────

  async addDiscountCode(subscriptionExternalId, discountCode) {
    try {
      if (discountCode.startsWith('promo_')) {
        return stripe.subscriptions.update(subscriptionExternalId, {
          discounts: [{ promotion_code: discountCode }],
        })
      }
      if (discountCode.startsWith('coupon_') || discountCode.includes('_')) {
        return stripe.subscriptions.update(subscriptionExternalId, {
          discounts: [{ coupon: discountCode }],
        })
      }
      // Try as promotion code string first
      try {
        const promoCodes = await stripe.promotionCodes.list({ code: discountCode, active: true, limit: 1 })
        if (promoCodes.data.length > 0) {
          return stripe.subscriptions.update(subscriptionExternalId, {
            discounts: [{ promotion_code: promoCodes.data[0].id }],
          })
        }
      } catch (_) {
        // Fallback to coupon
        return stripe.subscriptions.update(subscriptionExternalId, {
          discounts: [{ coupon: discountCode }],
        })
      }
      throw new Error(`Promotion code or coupon '${discountCode}' not found or inactive`)
    } catch (err) {
      throw new Error(`Error adding discount ${discountCode}: ${err.message}`)
    }
  }

  // ── Plan listing (cached 24h) ────────────────────────────────────────────

  async getAvailablePlans() {
    if (this._isCacheValid()) return this._planCache.data

    const prices = await stripe.prices.list({ active: true, limit: 100, expand: ['data.product'] })
    const plans = prices.data
      .filter((p) => (p.type === 'recurring' || p.type === 'one_time') && p.active)
      .map((price) => {
        const product = typeof price.product === 'object' ? price.product : null
        return {
          id: price.id,
          productId: product?.id || price.product,
          name: product?.name || 'Unknown Plan',
          description: product?.description || '',
          image: product?.images?.[0] || null,
          price: price.unit_amount / 100,
          currency: (price.currency || 'usd').toUpperCase(),
          interval: price.recurring?.interval || 'one_time',
          intervalCount: price.recurring?.interval_count || 1,
          type: price.type,
          metadata: product?.metadata || {},
          features: product?.metadata?.features ? JSON.parse(product.metadata.features) : [],
        }
      })
      .sort((a, b) => {
        const am = a.interval === 'year' ? a.price / 12 : a.price
        const bm = b.interval === 'year' ? b.price / 12 : b.price
        return am - bm
      })

    this._planCache = { data: plans, ts: Date.now(), ttl: this._planCache.ttl }
    return plans
  }

  // ── Period helpers (Stripe API v2024+) ───────────────────────────────────

  getCurrentPeriodEnd(obj) {
    return obj.current_period_end || obj.items?.data?.[0]?.current_period_end || null
  }

  getCurrentPeriodStart(obj) {
    return obj.current_period_start || obj.items?.data?.[0]?.current_period_start || null
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  _extractCountry(customer, obj = null) {
    return customer?.address?.country
      || customer?.shipping?.address?.country
      || obj?.customer_details?.address?.country
      || null
  }

  _normalizePeriodicity(interval) {
    if (interval === 'month' || interval === 'year') return interval
    return interval ? 'one-time' : null
  }

  _calculateCredits(obj) {
    const rawAmount = obj.amount_subtotal || obj.amount_total || obj.plan?.amount || 0
    return parseInt(rawAmount * CREDITS_MULTIPLIER / 100) || 0
  }

  _isCreditsPurchase(obj, product = null, paymentLink = null) {
    return obj?.metadata?.isCreditsPurchase === 'true'
      || product?.name?.toLowerCase().includes('credits')
      || product?.metadata?.isCreditsPurchase === 'true'
      || paymentLink?.metadata?.isCreditsPurchase === 'true'
  }

  _getCustomFields(obj) {
    return obj.custom_fields?.map((f) => ({ name: f.key, value: f.text?.value || '' })) || []
  }

  _mapCancellationReason(obj) {
    const reason = obj.cancellation_details?.reason
    if (reason === 'cancellation_requested') return { type: 'manual_cancellation', reason: 'user_requested_cancellation' }
    if (reason === 'payment_failed') return { type: 'payment_failed', reason: 'payment_failed' }
    if (reason === 'payment_disputed') return { type: 'payment_failed', reason: 'payment_disputed' }
    if (obj.status === 'past_due') return { type: 'payment_failed', reason: 'payment_overdue' }
    if (obj.status === 'unpaid') return { type: 'payment_failed', reason: 'payment_unpaid' }
    if (obj.status === 'incomplete') return { type: 'checkout_incomplete', reason: 'incomplete_payment' }
    if (obj.status === 'incomplete_expired') return { type: 'checkout_incomplete', reason: 'incomplete_expired' }
    if (obj.canceled_at && obj.cancel_at_period_end) return { type: 'manual_cancellation', reason: 'user_scheduled_cancellation' }
    if (obj.canceled_at) return { type: 'manual_cancellation', reason: 'canceled_no_specific_reason' }
    if (obj.status === 'canceled') return { type: 'manual_cancellation', reason: 'canceled_generic' }
    return { type: 'unknown', reason: reason || `status_${obj.status}` }
  }

  _createCancellationMetadata(obj, type, reason, existingMeta = {}) {
    const userReason = existingMeta.cancellation_reason
    const finalReason = (userReason && userReason.length > 50) ? userReason : reason

    return {
      ...existingMeta,
      cancellation_type: type,
      cancellation_reason: finalReason,
      cancellation_source: existingMeta.cancellation_source || 'stripe_webhook',
      canceled_by: existingMeta.canceled_by || 'system',
      stripe_cancellation_reason: obj.cancellation_details?.reason || null,
      stripe_cancellation_feedback: obj.cancellation_details?.feedback || null,
      stripe_cancellation_comment: obj.cancellation_details?.comment || null,
      stripe_canceled_at: obj.canceled_at ? new Date(obj.canceled_at * 1000).toISOString() : null,
      stripe_status: obj.status || 'canceled',
      webhook_updated_at: new Date().toISOString(),
    }
  }
}

// Mix webhook + payment/tax methods onto the prototype so `this` binds correctly.
Object.assign(StripeService.prototype, webhookMethods, paymentMethods)

module.exports = new StripeService()
