// @system — Polar.sh API routes
// Mirrors the Stripe routes as a drop-in alternative payment provider.
// Request bodies are validated with zod (Validation/schemas/@system/polar.js).
const express = require('express')
const router = express.Router()
const polar = require('../../../lib/@system/Polar')
const { authenticate } = require('../../../lib/@system/Helpers/auth')
const logger = require('../../../lib/@system/Logger')
const { validate } = require('../../../lib/@system/Validation')
const { PolarCheckoutBody } = require('../../../lib/@system/Validation/schemas/@system/polar')
const PolarSubscriptionRepo = require('../../../db/repos/@system/PolarSubscriptionRepo')
const Mutex = require('../../../lib/@system/Mutex')

// Mutex prevents concurrent processing of duplicate webhook events (per subscription).
// Mirrors the Stripe webhook route so subscription status transitions applied by
// handlePolarEvent cannot race or be applied out of order for the same customer.
const webhookMutex = new Mutex()

// ── POST /api/polar/create-checkout-session ─────────────────────────────────
// Authenticated user requests a hosted checkout URL for a given Polar price.
router.post('/polar/create-checkout-session', authenticate, validate({ body: PolarCheckoutBody }), async (req, res, next) => {
  try {
    const { productPriceId } = req.body
    if (!productPriceId) {
      return res.status(400).json({ message: 'productPriceId is required' })
    }

    const session = await polar.createCheckoutSession({
      productPriceId,
      successUrl: `${process.env.APP_URL}/app?checkout=success`,
      customerEmail: req.user.email,
      metadata: { user_id: String(req.user.id) },
    })

    res.json({ url: session.url })
  } catch (err) {
    next(err)
  }
})

// ── GET /api/polar/subscription ─────────────────────────────────────────────
// Returns the current user's active Polar subscription.
router.get('/polar/subscription', authenticate, async (req, res, next) => {
  try {
    const subscription = await PolarSubscriptionRepo.findActiveByUserId(req.user.id)
    res.json({ subscription: subscription ?? null })
  } catch (err) {
    next(err)
  }
})

// ── DELETE /api/polar/subscription ──────────────────────────────────────────
// Cancel the current user's active Polar subscription (at period end).
router.delete('/polar/subscription', authenticate, async (req, res, next) => {
  try {
    const subscription = await PolarSubscriptionRepo.findActiveByUserId(req.user.id)
    if (!subscription) {
      return res.status(404).json({ message: 'No active Polar subscription found' })
    }

    await polar.cancelSubscription(subscription.polar_subscription_id)

    const updated = await PolarSubscriptionRepo.update(subscription.id, {
      cancel_at_period_end: true,
    })

    res.json({ subscription: updated })
  } catch (err) {
    next(err)
  }
})

// ── GET /api/polar/products ──────────────────────────────────────────────────
// List available Polar products (public — used on pricing page).
router.get('/polar/products', async (req, res, next) => {
  try {
    const data = await polar.listProducts()
    res.json({ products: data.items ?? [] })
  } catch (err) {
    next(err)
  }
})

// ── POST /api/polar/webhook ──────────────────────────────────────────────────
// Polar webhook endpoint. Must receive the raw body for signature validation.
router.post(
  '/polar/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['x-polar-signature-256']

    let event
    try {
      event = polar.validateWebhook(req.body, signature)
    } catch (err) {
      logger.warn({ err: err.message }, 'polar webhook signature invalid')
      return res.status(400).json({ message: err.message })
    }

    logger.info({ eventType: event.type }, 'polar webhook received')

    // Use mutex keyed by the affected subscription to prevent race conditions
    // on duplicate/overlapping events (parity with the Stripe webhook route).
    const mutexKey = event.data?.id || event.id || event.type

    try {
      await webhookMutex.run(mutexKey, () => handlePolarEvent(event))
    } catch (err) {
      logger.error({ err, eventType: event.type }, 'polar webhook handler error')
      // Return 200 to avoid Polar retrying — log and investigate manually.
    }

    res.json({ received: true })
  },
)

// ── Event handler ─────────────────────────────────────────────────────────────

async function handlePolarEvent(event) {
  const { type, data } = event

  switch (type) {
    case 'subscription.created':
    case 'subscription.updated': {
      const sub = data
      if (!sub.metadata?.user_id) {
        logger.warn({ polarSubId: sub.id }, 'polar subscription missing user_id metadata')
        break
      }

      const userId = parseInt(sub.metadata.user_id, 10)

      await PolarSubscriptionRepo.upsertByPolarSubscriptionId({
        user_id: userId,
        polar_subscription_id: sub.id,
        polar_product_id: sub.product_id,
        polar_price_id: sub.price_id,
        status: sub.status,
        current_period_start: sub.current_period_start,
        current_period_end: sub.current_period_end,
        cancel_at_period_end: sub.cancel_at_period_end ?? false,
      })
      break
    }

    case 'subscription.canceled':
    case 'subscription.revoked': {
      const sub = data
      const existing = await PolarSubscriptionRepo.findByPolarSubscriptionId(sub.id)
      if (existing) {
        await PolarSubscriptionRepo.update(existing.id, { status: 'canceled', cancel_at_period_end: true })
      }
      break
    }

    case 'subscription.active': {
      const sub = data
      const existing = await PolarSubscriptionRepo.findByPolarSubscriptionId(sub.id)
      if (existing) {
        await PolarSubscriptionRepo.update(existing.id, { status: 'active' })
      }
      break
    }

    case 'order.created': {
      // One-time purchase — log only; extend if needed.
      logger.info({ orderId: data.id }, 'polar order.created')
      break
    }

    default:
      logger.info({ eventType: type }, 'polar webhook: unhandled event type')
  }
}

module.exports = router
