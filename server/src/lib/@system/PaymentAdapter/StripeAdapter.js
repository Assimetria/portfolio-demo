// @system — Stripe payment adapter implementation
'use strict'

const stripe  = require('../Stripe')
const logger  = require('../Logger')

/**
 * Normalise a Stripe subscription object into the shared subscription shape.
 * @param {Object} sub  Raw Stripe subscription
 * @returns {import('./index').NormalizedSubscription}
 */
function normalizeSubscription(sub) {
  const item = sub.items?.data?.[0]
  return {
    provider:            'stripe',
    subscriptionId:      sub.id,
    customerId:          sub.customer ?? null,
    priceId:             item?.price?.id ?? null,
    productId:           item?.price?.product ?? null,
    status:              sub.status,
    currentPeriodStart:  sub.current_period_start ? new Date(sub.current_period_start * 1000) : null,
    currentPeriodEnd:    sub.current_period_end   ? new Date(sub.current_period_end   * 1000) : null,
    cancelAtPeriodEnd:   sub.cancel_at_period_end ?? false,
  }
}

const StripeAdapter = {
  provider: 'stripe',

  // ── Checkout ────────────────────────────────────────────────────────────────

  async createCheckoutSession({ priceId, userId, userEmail, trialDays, successUrl, cancelUrl }) {
    if (!priceId)    throw Object.assign(new Error('priceId is required'),   { status: 400 })
    if (!userId)     throw Object.assign(new Error('userId is required'),    { status: 400 })
    if (!userEmail)  throw Object.assign(new Error('userEmail is required'), { status: 400 })

    const appUrl = process.env.APP_URL ?? 'http://localhost:5173'

    const params = {
      mode:                 'subscription',
      payment_method_types: ['card'],
      line_items:           [{ price: priceId, quantity: 1 }],
      success_url:          successUrl ?? `${appUrl}/app/billing?checkout=success`,
      cancel_url:           cancelUrl  ?? `${appUrl}/pricing`,
      customer_email:       userEmail,
      client_reference_id:  String(userId),
      metadata:             { user_id: String(userId) },
    }

    if (trialDays && Number(trialDays) > 0) {
      params.subscription_data = {
        trial_period_days: Number(trialDays),
        metadata: { user_id: String(userId) },
      }
    }

    const session = await stripe.checkout.sessions.create(params)
    logger.info({ userId, sessionId: session.id }, '[StripeAdapter] checkout session created')

    return { url: session.url, sessionId: session.id }
  },

  // ── Customer Portal ─────────────────────────────────────────────────────────

  async createPortalSession({ customerId, returnUrl }) {
    if (!customerId) throw Object.assign(new Error('customerId is required'), { status: 400 })

    const appUrl   = process.env.APP_URL ?? 'http://localhost:5173'
    const session  = await stripe.billingPortal.sessions.create({
      customer:   customerId,
      return_url: returnUrl ?? `${appUrl}/app/billing`,
    })

    return { url: session.url }
  },

  // ── Cancel / Uncancel ───────────────────────────────────────────────────────

  async cancelSubscription(subscriptionId) {
    if (!subscriptionId) throw Object.assign(new Error('subscriptionId is required'), { status: 400 })

    const updated = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })
    logger.info({ subscriptionId }, '[StripeAdapter] subscription cancel scheduled')
    return normalizeSubscription(updated)
  },

  async uncancelSubscription(subscriptionId) {
    if (!subscriptionId) throw Object.assign(new Error('subscriptionId is required'), { status: 400 })

    const updated = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false })
    logger.info({ subscriptionId }, '[StripeAdapter] subscription cancellation reversed')
    return normalizeSubscription(updated)
  },

  // ── Plans ───────────────────────────────────────────────────────────────────

  async listPlans() {
    if (!process.env.STRIPE_SECRET_KEY) return []

    const prices = await stripe.prices.list({
      active:  true,
      expand:  ['data.product'],
      limit:   50,
    })

    return prices.data
      .filter((price) => {
        const product = price.product
        return (
          price.active &&
          product &&
          typeof product === 'object' &&
          product.active &&
          product.metadata?.hidden !== 'true'
        )
      })
      .map((price) => {
        const product = price.product
        return {
          provider:      'stripe',
          priceId:       price.id,
          productId:     product.id,
          name:          product.name,
          description:   product.description ?? null,
          amount:        price.unit_amount,
          currency:      price.currency,
          interval:      price.recurring?.interval ?? 'one_time',
          intervalCount: price.recurring?.interval_count ?? 1,
          trialDays:     price.recurring?.trial_period_days ?? null,
          metadata:      { ...product.metadata, ...price.metadata },
        }
      })
      .sort((a, b) => Number(a.metadata?.order ?? 99) - Number(b.metadata?.order ?? 99))
  },

  // ── Webhook ─────────────────────────────────────────────────────────────────

  async validateWebhook(rawBody, headers) {
    const sig    = headers['stripe-signature']
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) throw Object.assign(new Error('STRIPE_WEBHOOK_SECRET is not set'), { status: 500 })

    let event
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, secret)
    } catch (err) {
      throw Object.assign(new Error(`Stripe webhook signature verification failed: ${err.message}`), { status: 400 })
    }

    return { provider: 'stripe', type: event.type, data: event.data.object, raw: event }
  },
}

module.exports = StripeAdapter
