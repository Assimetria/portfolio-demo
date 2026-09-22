// @system — Stripe checkout + webhook + portal + discount
// Full billing infrastructure ported from Simtria with all edge cases.
// Request bodies are validated with zod (Validation/schemas/@system/stripe.js); the webhook stays raw.
'use strict'

const express = require('express')
const router = express.Router()
const stripe = require('../../../lib/@system/Stripe')
const StripeService = require('../../../lib/@system/Stripe/StripeService')
const { authenticate } = require('../../../lib/@system/Helpers/auth')
const SubscriptionRepo = require('../../../db/repos/@system/SubscriptionRepo')
const logger = require('../../../lib/@system/Logger')
const Mutex = require('../../../lib/@system/Mutex')
const { handleWebhookEvent } = require('./webhook-handler')
const { validate } = require('../../../lib/@system/Validation')
const {
  StripeCheckoutBody,
  StripeCancelBody,
  StripeUpgradeBody,
  StripeReportUsageBody,
  StripeDiscountBody,
} = require('../../../lib/@system/Validation/schemas/@system/stripe')

// Mutex prevents concurrent processing of duplicate webhook events (keyed by email/customer)
const webhookMutex = new Mutex()

// ─── Prices (GET parity with Pacekit/SendVerb) ─────────────────────────────

// GET /api/stripe/prices — return 401 for unauthenticated (not 404)
router.get('/stripe/prices', authenticate, async (req, res, next) => {
  try {
    const prices = await stripe.prices.list({ active: true, limit: 100 })
    res.json({ prices: prices.data })
  } catch (err) {
    next(err)
  }
})

// ─── Checkout ────────────────────────────────────────────────────────────────

// POST /api/stripe/create-checkout-session
router.post('/stripe/create-checkout-session', authenticate, validate({ body: StripeCheckoutBody }), async (req, res, next) => {
  try {
    const { priceId, trialDays } = req.body
    if (!priceId) return res.status(400).json({ message: 'priceId is required' })

    const sessionParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL}/app/billing?checkout=success`,
      cancel_url: `${process.env.APP_URL}/pricing`,
      customer_email: req.user.email,
      client_reference_id: String(req.user.id),
      metadata: { user_id: String(req.user.id) },
    }

    if (trialDays && Number(trialDays) > 0) {
      sessionParams.subscription_data = {
        trial_period_days: Number(trialDays),
        metadata: { user_id: String(req.user.id) },
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)
    res.json({ url: session.url })
  } catch (err) {
    next(err)
  }
})

// ─── Customer Portal ─────────────────────────────────────────────────────────

// POST /api/stripe/create-portal-session
router.post('/stripe/create-portal-session', authenticate, async (req, res, next) => {
  try {
    const subscription = await SubscriptionRepo.findActiveByUserId(req.user.id)
    if (!subscription?.stripe_customer_id) {
      return res.status(404).json({ message: 'No active subscription found' })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${process.env.APP_URL}/app/billing`,
    })

    res.json({ url: session.url })
  } catch (err) {
    next(err)
  }
})

// ─── Cancel / Uncancel ───────────────────────────────────────────────────────

// POST /api/stripe/cancel-subscription
router.post('/stripe/cancel-subscription', authenticate, validate({ body: StripeCancelBody }), async (req, res, next) => {
  try {
    const { reason, feedback } = req.body || {}
    const subscription = await SubscriptionRepo.findActiveByUserId(req.user.id)
    if (!subscription?.stripe_subscription_id) {
      return res.status(404).json({ message: 'No active subscription found' })
    }

    const updated = await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: true,
    })

    // Store user-provided cancellation reason in metadata
    const cancelMeta = {
      ...(subscription.metadata || {}),
      cancellation_reason: reason || 'user_requested_cancellation',
      cancellation_feedback: feedback || null,
      cancellation_source: 'user_action',
      canceled_by: 'user',
      cancel_requested_at: new Date().toISOString(),
    }

    await SubscriptionRepo.update(subscription.id, {
      cancel_at_period_end: true,
      current_period_end: new Date(updated.current_period_end * 1000),
      metadata: cancelMeta,
    })

    res.json({ message: 'Subscription will cancel at period end', cancel_at_period_end: true })
  } catch (err) {
    next(err)
  }
})

// POST /api/stripe/uncancel-subscription
router.post('/stripe/uncancel-subscription', authenticate, async (req, res, next) => {
  try {
    const subscription = await SubscriptionRepo.findActiveByUserId(req.user.id)
    if (!subscription?.stripe_subscription_id) {
      return res.status(404).json({ message: 'No active subscription found' })
    }

    const updated = await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: false,
    })

    // Clean up cancellation metadata on uncancel
    const existingMeta = subscription.metadata || {}
    const {
      cancellation_type, cancellation_reason, stripe_cancellation_reason,
      stripe_status, stripe_canceled_at, cancellation_source, canceled_by,
      cancel_requested_at, cancellation_feedback,
      ...cleanMeta
    } = existingMeta

    await SubscriptionRepo.update(subscription.id, {
      cancel_at_period_end: false,
      current_period_end: new Date(updated.current_period_end * 1000),
      metadata: cleanMeta,
    })

    res.json({ message: 'Subscription cancellation reversed', cancel_at_period_end: false })
  } catch (err) {
    next(err)
  }
})

// ─── Upgrade plan ────────────────────────────────────────────────────────────

// POST /api/stripe/upgrade-subscription
router.post('/stripe/upgrade-subscription', authenticate, validate({ body: StripeUpgradeBody }), async (req, res, next) => {
  try {
    const { priceId } = req.body
    if (!priceId) return res.status(400).json({ message: 'priceId is required' })

    const subscription = await SubscriptionRepo.findActiveByUserId(req.user.id)
    if (!subscription?.stripe_subscription_id) {
      return res.status(404).json({ message: 'No active subscription found' })
    }

    const updated = await StripeService.updateSubscriptionPlan(subscription.stripe_subscription_id, priceId)
    const item = updated.items.data[0]

    await SubscriptionRepo.update(subscription.id, {
      stripe_price_id: item.price.id,
      plan: item.price.metadata?.plan || item.price.nickname || subscription.plan,
      price: item.price.unit_amount || subscription.price,
      periodicity: item.price.recurring?.interval || subscription.periodicity,
      current_period_end: new Date(updated.current_period_end * 1000),
    })

    res.json({
      message: 'Subscription upgraded',
      subscription: {
        priceId: item.price.id,
        amount: item.price.unit_amount,
        interval: item.price.recurring?.interval,
      },
    })
  } catch (err) {
    next(err)
  }
})

// ─── Usage-based billing ─────────────────────────────────────────────────────

// POST /api/stripe/report-usage — report metered usage for current subscription
router.post('/stripe/report-usage', authenticate, validate({ body: StripeReportUsageBody }), async (req, res, next) => {
  try {
    const { quantity, action } = req.body
    if (!quantity || quantity < 1) return res.status(400).json({ message: 'quantity is required (positive integer)' })

    const subscription = await SubscriptionRepo.findActiveByUserId(req.user.id)
    if (!subscription?.stripe_subscription_id) {
      return res.status(404).json({ message: 'No active subscription found' })
    }

    const record = await StripeService.reportUsage(
      subscription.stripe_subscription_id,
      quantity,
      action || 'increment',
    )
    res.json({ message: 'Usage reported', record })
  } catch (err) {
    next(err)
  }
})

// GET /api/stripe/usage-summary — get current period usage summary
router.get('/stripe/usage-summary', authenticate, async (req, res, next) => {
  try {
    const subscription = await SubscriptionRepo.findActiveByUserId(req.user.id)
    if (!subscription?.stripe_subscription_id) {
      return res.status(404).json({ message: 'No active subscription found' })
    }

    const summary = await StripeService.getUsageSummary(subscription.stripe_subscription_id)
    res.json({ summary })
  } catch (err) {
    next(err)
  }
})

// POST /api/stripe/create-metered-checkout — checkout for usage-based price
router.post('/stripe/create-metered-checkout', authenticate, validate({ body: StripeCheckoutBody }), async (req, res, next) => {
  try {
    const { priceId, trialDays } = req.body
    if (!priceId) return res.status(400).json({ message: 'priceId is required' })

    const session = await StripeService.createMeteredCheckout({
      priceId,
      userId: req.user.id,
      email: req.user.email,
      trialDays,
    })
    res.json({ url: session.url })
  } catch (err) {
    next(err)
  }
})

// ─── Discount code ───────────────────────────────────────────────────────────

// POST /api/stripe/apply-discount
router.post('/stripe/apply-discount', authenticate, validate({ body: StripeDiscountBody }), async (req, res, next) => {
  try {
    const { discountCode } = req.body
    if (!discountCode) return res.status(400).json({ message: 'discountCode is required' })

    const subscription = await SubscriptionRepo.findActiveByUserId(req.user.id)
    if (!subscription?.stripe_subscription_id) {
      return res.status(404).json({ message: 'No active subscription found' })
    }

    await StripeService.addDiscountCode(subscription.stripe_subscription_id, discountCode)
    res.json({ message: 'Discount code applied' })
  } catch (err) {
    next(err)
  }
})

// ─── Webhook ─────────────────────────────────────────────────────────────────

// POST /api/stripe/webhook
// MUST be mounted before express.json() parses the body — uses raw body
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']

  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    logger.warn({ err }, 'stripe webhook signature verification failed')
    return res.status(400).json({ message: err.message })
  }

  logger.info({ eventType: event.type }, 'stripe webhook received')

  // Use mutex keyed by customer ID to prevent race conditions on duplicate events
  const mutexKey = event.data?.object?.customer || event.data?.object?.id || event.id
  try {
    await webhookMutex.run(mutexKey, () => handleWebhookEvent(event))
    res.json({ received: true })
  } catch (err) {
    logger.error({ err, eventType: event.type }, 'stripe webhook handler error')
    // Return 200 so Stripe doesn't retry — log the error instead
    res.json({ received: true, warning: err.message })
  }
})

module.exports = router
