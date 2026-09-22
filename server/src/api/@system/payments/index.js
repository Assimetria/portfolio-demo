// @system — Unified payment routes (provider-agnostic)
// Uses PaymentAdapter to work with Stripe OR Polar based on PAYMENT_PROVIDER env var.
// These routes replace the need to call /stripe/* or /polar/* directly from the client.
//
// Routes:
//   GET    /api/payments/provider             — returns active provider name
//   GET    /api/payments/plans                — list available plans
//   POST   /api/payments/checkout             — create checkout session
//   POST   /api/payments/portal               — create billing portal session
//   GET    /api/payments/subscription         — get current user's active subscription
//   GET    /api/payments/subscriptions        — get all of current user's subscriptions
//   DELETE /api/payments/subscription         — cancel subscription
//   POST   /api/payments/subscription/resume  — uncancel subscription
//   POST   /api/payments/webhook              — inbound webhook (raw body, no auth)
//
// Request bodies are validated with zod (Validation/schemas/@system/payments.js).

'use strict'

const express         = require('express')
const router          = express.Router()
const payment         = require('../../../lib/@system/PaymentAdapter')
const { authenticate} = require('../../../lib/@system/Helpers/auth')
const logger          = require('../../../lib/@system/Logger')
const { validate }    = require('../../../lib/@system/Validation')
const { PaymentsCheckoutBody } = require('../../../lib/@system/Validation/schemas/@system/payments')
const SubscriptionRepo      = require('../../../db/repos/@system/SubscriptionRepo')
const PolarSubscriptionRepo = require('../../../db/repos/@system/PolarSubscriptionRepo')
const UserRepo              = require('../../../db/repos/@system/UserRepo')

// ── Provider info ────────────────────────────────────────────────────────────

// GET /api/payments/provider
router.get('/payments/provider', (_req, res) => {
  res.json({ provider: payment.provider })
})

// ── Plans ────────────────────────────────────────────────────────────────────

// GET /api/payments/plans
router.get('/payments/plans', async (_req, res, next) => {
  try {
    const plans = await payment.listPlans()
    res.json({ plans, provider: payment.provider })
  } catch (err) {
    next(err)
  }
})

// ── Checkout ─────────────────────────────────────────────────────────────────

// POST /api/payments/checkout
// Body: { priceId, trialDays? }
router.post('/payments/checkout', authenticate, validate({ body: PaymentsCheckoutBody }), async (req, res, next) => {
  try {
    const { priceId, trialDays } = req.body
    const result = await payment.createCheckoutSession({
      priceId,
      trialDays,
      userId:    req.user.id,
      userEmail: req.user.email,
    })
    res.json(result)
  } catch (err) {
    next(err)
  }
})

// ── Billing portal ────────────────────────────────────────────────────────────

// POST /api/payments/portal
router.post('/payments/portal', authenticate, async (req, res, next) => {
  try {
    // For Stripe: look up the stripe_customer_id on the active subscription
    const sub = await SubscriptionRepo.findActiveByUserId(req.user.id)
    const customerId = sub?.stripe_customer_id

    const result = await payment.createPortalSession({ customerId })
    res.json(result)
  } catch (err) {
    next(err)
  }
})

// ── Subscription helpers ──────────────────────────────────────────────────────

async function getActiveSubscription(userId) {
  if (payment.provider === 'polar') {
    const sub = await PolarSubscriptionRepo.findActiveByUserId(userId)
    if (!sub) return null
    return {
      provider:           'polar',
      subscriptionId:     sub.polar_subscription_id,
      priceId:            sub.polar_price_id,
      productId:          sub.polar_product_id,
      status:             sub.status,
      currentPeriodStart: sub.current_period_start,
      currentPeriodEnd:   sub.current_period_end,
      cancelAtPeriodEnd:  sub.cancel_at_period_end,
      _raw: sub,
    }
  }

  const sub = await SubscriptionRepo.findActiveByUserId(userId)
  if (!sub) return null
  return {
    provider:           'stripe',
    subscriptionId:     sub.stripe_subscription_id,
    customerId:         sub.stripe_customer_id,
    priceId:            sub.stripe_price_id,
    status:             sub.status,
    currentPeriodStart: sub.current_period_start,
    currentPeriodEnd:   sub.current_period_end,
    cancelAtPeriodEnd:  sub.cancel_at_period_end,
    _raw: sub,
  }
}

// GET /api/payments/subscription
router.get('/payments/subscription', authenticate, async (req, res, next) => {
  try {
    const subscription = await getActiveSubscription(req.user.id)
    res.json({ subscription, provider: payment.provider })
  } catch (err) {
    next(err)
  }
})

// GET /api/payments/subscriptions
router.get('/payments/subscriptions', authenticate, async (req, res, next) => {
  try {
    let subscriptions
    if (payment.provider === 'polar') {
      const rows = await PolarSubscriptionRepo.findByUserId(req.user.id)
      subscriptions = rows.map((sub) => ({
        provider:           'polar',
        subscriptionId:     sub.polar_subscription_id,
        priceId:            sub.polar_price_id,
        productId:          sub.polar_product_id,
        status:             sub.status,
        currentPeriodStart: sub.current_period_start,
        currentPeriodEnd:   sub.current_period_end,
        cancelAtPeriodEnd:  sub.cancel_at_period_end,
      }))
    } else {
      const rows = await SubscriptionRepo.findByUserId(req.user.id)
      subscriptions = rows.map((sub) => ({
        provider:           'stripe',
        subscriptionId:     sub.stripe_subscription_id,
        customerId:         sub.stripe_customer_id,
        priceId:            sub.stripe_price_id,
        status:             sub.status,
        currentPeriodStart: sub.current_period_start,
        currentPeriodEnd:   sub.current_period_end,
        cancelAtPeriodEnd:  sub.cancel_at_period_end,
      }))
    }
    res.json({ subscriptions, provider: payment.provider })
  } catch (err) {
    next(err)
  }
})

// ── Cancel ────────────────────────────────────────────────────────────────────

// DELETE /api/payments/subscription
router.delete('/payments/subscription', authenticate, async (req, res, next) => {
  try {
    const sub = await getActiveSubscription(req.user.id)
    if (!sub) return res.status(404).json({ message: 'No active subscription found' })

    const updated = await payment.cancelSubscription(sub.subscriptionId)

    // Persist the change locally
    if (payment.provider === 'polar') {
      await PolarSubscriptionRepo.update(sub._raw.id, { cancel_at_period_end: true, status: updated.status })
    } else {
      await SubscriptionRepo.update(sub._raw.id, {
        cancel_at_period_end: true,
        current_period_end: updated.currentPeriodEnd,
      })
    }

    res.json({ subscription: updated })
  } catch (err) {
    next(err)
  }
})

// POST /api/payments/subscription/resume
router.post('/payments/subscription/resume', authenticate, async (req, res, next) => {
  try {
    const sub = await getActiveSubscription(req.user.id)
    if (!sub) return res.status(404).json({ message: 'No active subscription found' })

    const updated = await payment.uncancelSubscription(sub.subscriptionId)

    if (payment.provider === 'stripe') {
      await SubscriptionRepo.update(sub._raw.id, {
        cancel_at_period_end: false,
        current_period_end: updated.currentPeriodEnd,
      })
    }

    res.json({ subscription: updated })
  } catch (err) {
    next(err)
  }
})

// ── Webhook ───────────────────────────────────────────────────────────────────

// POST /api/payments/webhook
// Must be placed BEFORE express.json() consumes the body — uses express.raw().
router.post('/payments/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  let event
  try {
    event = await payment.validateWebhook(req.body, req.headers)
  } catch (err) {
    logger.warn({ err: err.message }, '[PaymentAdapter] webhook validation failed')
    return res.status(err.status ?? 400).json({ message: err.message })
  }

  logger.info({ provider: event.provider, type: event.type }, '[PaymentAdapter] webhook received')

  try {
    if (event.provider === 'stripe') {
      await handleStripeEvent(event)
    } else {
      await handlePolarEvent(event)
    }
    res.json({ received: true })
  } catch (err) {
    logger.error({ err, eventType: event.type }, '[PaymentAdapter] webhook handler error')
    // Return 200 to prevent provider retrying — errors are logged for manual investigation
    res.json({ received: true, warning: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Stripe event handlers
// ─────────────────────────────────────────────────────────────────────────────

const stripe = require('../../../lib/@system/Stripe')

async function handleStripeEvent({ type, data: obj }) {
  switch (type) {
    case 'checkout.session.completed': {
      if (obj.mode !== 'subscription') break
      const userId = obj.client_reference_id ?? obj.metadata?.user_id
      if (!userId) {
        logger.warn({ sessionId: obj.id }, 'checkout.session.completed: no user_id in metadata')
        break
      }
      await UserRepo.updateStripeCustomerId(Number(userId), obj.customer)
      const stripeSub = await stripe.subscriptions.retrieve(obj.subscription)
      const item = stripeSub.items.data[0]
      await SubscriptionRepo.upsertByStripeSubscriptionId({
        user_id:               Number(userId),
        stripe_subscription_id: stripeSub.id,
        stripe_customer_id:    obj.customer,
        stripe_price_id:       item.price.id,
        status:                stripeSub.status,
        current_period_start:  new Date(stripeSub.current_period_start * 1000),
        current_period_end:    new Date(stripeSub.current_period_end   * 1000),
        cancel_at_period_end:  stripeSub.cancel_at_period_end,
      })
      logger.info({ userId, subscriptionId: stripeSub.id }, 'stripe: checkout completed')
      break
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const user   = await UserRepo.findByStripeCustomerId(obj.customer)
      const userId = obj.metadata?.user_id ? Number(obj.metadata.user_id) : user?.id
      if (!userId) {
        logger.warn({ customerId: obj.customer }, `stripe: ${type} — could not resolve user`)
        break
      }
      const item = obj.items?.data?.[0]
      await SubscriptionRepo.upsertByStripeSubscriptionId({
        user_id:               userId,
        stripe_subscription_id: obj.id,
        stripe_customer_id:    obj.customer,
        stripe_price_id:       item?.price?.id,
        status:                obj.status,
        current_period_start:  new Date(obj.current_period_start * 1000),
        current_period_end:    new Date(obj.current_period_end   * 1000),
        cancel_at_period_end:  obj.cancel_at_period_end,
      })
      logger.info({ userId, subscriptionId: obj.id }, `stripe: ${type}`)
      break
    }

    case 'customer.subscription.deleted': {
      const existing = await SubscriptionRepo.findByStripeSubscriptionId(obj.id)
      if (existing) await SubscriptionRepo.updateStatus(existing.id, 'cancelled')
      logger.info({ subscriptionId: obj.id }, 'stripe: subscription deleted')
      break
    }

    case 'invoice.payment_failed': {
      if (!obj.subscription) break
      const existing = await SubscriptionRepo.findByStripeSubscriptionId(obj.subscription)
      if (existing) await SubscriptionRepo.updateStatus(existing.id, 'past_due')
      logger.warn({ subscriptionId: obj.subscription }, 'stripe: invoice payment failed')
      break
    }

    case 'invoice.payment_succeeded': {
      if (!obj.subscription) break
      const existing = await SubscriptionRepo.findByStripeSubscriptionId(obj.subscription)
      if (!existing) break
      const freshSub = await stripe.subscriptions.retrieve(obj.subscription)
      await SubscriptionRepo.update(existing.id, {
        status:               freshSub.status,
        current_period_start: new Date(freshSub.current_period_start * 1000),
        current_period_end:   new Date(freshSub.current_period_end   * 1000),
        cancel_at_period_end: freshSub.cancel_at_period_end,
      })
      logger.info({ subscriptionId: obj.subscription }, 'stripe: invoice payment succeeded')
      break
    }

    default:
      logger.debug({ eventType: type }, 'stripe: unhandled event type')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Polar event handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handlePolarEvent({ type, data: sub }) {
  switch (type) {
    case 'subscription.created':
    case 'subscription.updated':
    case 'subscription.active': {
      const userId = sub.metadata?.user_id ? parseInt(sub.metadata.user_id, 10) : null
      if (!userId) {
        logger.warn({ polarSubId: sub.id }, `polar: ${type} — missing user_id in metadata`)
        break
      }
      await PolarSubscriptionRepo.upsertByPolarSubscriptionId({
        user_id:              userId,
        polar_subscription_id: sub.id,
        polar_product_id:     sub.product_id,
        polar_price_id:       sub.price_id,
        status:               sub.status,
        current_period_start: sub.current_period_start,
        current_period_end:   sub.current_period_end,
        cancel_at_period_end: sub.cancel_at_period_end ?? false,
      })
      logger.info({ userId, polarSubId: sub.id }, `polar: ${type}`)
      break
    }

    case 'subscription.canceled':
    case 'subscription.revoked': {
      const existing = await PolarSubscriptionRepo.findByPolarSubscriptionId(sub.id)
      if (existing) {
        await PolarSubscriptionRepo.update(existing.id, {
          status:             'canceled',
          cancel_at_period_end: true,
        })
      }
      logger.info({ polarSubId: sub.id }, `polar: ${type}`)
      break
    }

    case 'order.created':
      logger.info({ orderId: sub.id }, 'polar: order created (one-time purchase)')
      break

    default:
      logger.debug({ eventType: type }, 'polar: unhandled event type')
  }
}

module.exports = router
