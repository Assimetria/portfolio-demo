// @system — Polar.sh payment adapter implementation
'use strict'

const polar  = require('../Polar')
const logger = require('../Logger')

/**
 * Map a Polar subscription status to the normalised status vocabulary.
 * Polar statuses: active | trialing | past_due | canceled | revoked | incomplete | unpaid
 */
function normalizeStatus(polarStatus) {
  switch (polarStatus) {
    case 'active':     return 'active'
    case 'trialing':   return 'trialing'
    case 'past_due':   return 'past_due'
    case 'canceled':
    case 'revoked':    return 'canceled'
    default:           return 'inactive'
  }
}

/**
 * Normalise a Polar subscription object into the shared subscription shape.
 * @param {Object} sub  Raw Polar subscription
 * @returns {import('./index').NormalizedSubscription}
 */
function normalizeSubscription(sub) {
  return {
    provider:           'polar',
    subscriptionId:     sub.id,
    customerId:         sub.customer_id ?? null,
    priceId:            sub.price_id    ?? null,
    productId:          sub.product_id  ?? null,
    status:             normalizeStatus(sub.status),
    currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start) : null,
    currentPeriodEnd:   sub.current_period_end   ? new Date(sub.current_period_end)   : null,
    cancelAtPeriodEnd:  sub.cancel_at_period_end ?? false,
  }
}

const PolarAdapter = {
  provider: 'polar',

  // ── Checkout ────────────────────────────────────────────────────────────────

  async createCheckoutSession({ priceId, userId, userEmail, successUrl }) {
    if (!priceId)   throw Object.assign(new Error('priceId (productPriceId) is required'), { status: 400 })
    if (!userId)    throw Object.assign(new Error('userId is required'),                   { status: 400 })
    if (!userEmail) throw Object.assign(new Error('userEmail is required'),                { status: 400 })

    const appUrl  = process.env.APP_URL ?? 'http://localhost:5173'

    const session = await polar.createCheckoutSession({
      productPriceId: priceId,
      successUrl:     successUrl ?? `${appUrl}/app?checkout=success`,
      customerEmail:  userEmail,
      metadata:       { user_id: String(userId) },
    })

    logger.info({ userId, sessionId: session.id }, '[PolarAdapter] checkout session created')

    return { url: session.url, sessionId: session.id }
  },

  // ── Customer Portal ─────────────────────────────────────────────────────────
  // Polar does not expose a hosted billing portal. Redirect to Polar dashboard.

  async createPortalSession() {
    const err = new Error(
      'Polar does not support a hosted billing portal. ' +
      'Direct users to https://polar.sh/purchases to manage their subscription.',
    )
    err.status = 501
    throw err
  },

  // ── Cancel ──────────────────────────────────────────────────────────────────

  async cancelSubscription(subscriptionId) {
    if (!subscriptionId) throw Object.assign(new Error('subscriptionId is required'), { status: 400 })

    const updated = await polar.cancelSubscription(subscriptionId)
    logger.info({ subscriptionId }, '[PolarAdapter] subscription cancelled')
    return normalizeSubscription(updated)
  },

  // Polar does not expose an uncancel API — once canceled it stays canceled.
  async uncancelSubscription() {
    const err = new Error(
      'Polar does not support reversing a scheduled cancellation. ' +
      'Ask the customer to subscribe again.',
    )
    err.status = 501
    throw err
  },

  // ── Plans ───────────────────────────────────────────────────────────────────

  async listPlans() {
    if (!process.env.POLAR_ACCESS_TOKEN) return []

    const data = await polar.listProducts({ isArchived: false })
    const products = data.items ?? []

    /** @type {import('./index').NormalizedPlan[]} */
    const plans = []

    for (const product of products) {
      if (!product.is_recurring) continue        // skip one-time products
      if (product.is_archived)   continue

      for (const price of product.prices ?? []) {
        if (price.is_archived) continue

        // Polar price amounts are in smallest currency unit (same as Stripe)
        const amountCents = price.price_amount ?? 0
        const currency    = (price.price_currency ?? 'usd').toLowerCase()

        // Polar intervals: month | year
        const interval      = price.recurring_interval ?? 'month'
        const intervalCount = 1

        plans.push({
          provider:      'polar',
          priceId:       price.id,
          productId:     product.id,
          name:          product.name,
          description:   product.description ?? null,
          amount:        amountCents,
          currency,
          interval,
          intervalCount,
          trialDays:     null,   // Polar trial config is on the product, not easily extracted here
          metadata:      product.metadata ?? {},
        })
      }
    }

    return plans.sort((a, b) => Number(a.metadata?.order ?? 99) - Number(b.metadata?.order ?? 99))
  },

  // ── Webhook ─────────────────────────────────────────────────────────────────

  async validateWebhook(rawBody, headers) {
    const signature = headers['x-polar-signature-256']
    if (!signature) {
      throw Object.assign(new Error('Missing X-Polar-Signature-256 header'), { status: 400 })
    }

    const event = polar.validateWebhook(rawBody, signature)
    return { provider: 'polar', type: event.type, data: event.data, raw: event }
  },
}

module.exports = PolarAdapter
