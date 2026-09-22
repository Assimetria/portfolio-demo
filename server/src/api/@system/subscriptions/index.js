// @system — Subscriptions API
// Richer model ported from Simtria: user subscriptions, plans, cancel, upgrade, discount
// Request bodies are validated with zod (Validation/schemas/@system/subscriptions.js).
'use strict'

const express = require('express')
const router = express.Router()
const stripe = require('../../../lib/@system/Stripe')
const StripeService = require('../../../lib/@system/Stripe/StripeService')
const { authenticate } = require('../../../lib/@system/Helpers/auth')
const SubscriptionRepo = require('../../../db/repos/@system/SubscriptionRepo')
const { validate } = require('../../../lib/@system/Validation')
const {
  SubscriptionCancelBody,
  SubscriptionUpgradeBody,
  SubscriptionDiscountBody,
} = require('../../../lib/@system/Validation/schemas/@system/subscriptions')

// GET /api/subscriptions — current user's subscriptions (all)
router.get('/subscriptions', authenticate, async (req, res, next) => {
  try {
    const subscriptions = await SubscriptionRepo.findByUserId(req.user.id)
    res.json({ subscriptions })
  } catch (err) {
    next(err)
  }
})

// GET /api/subscriptions/me — current user's active subscription
router.get('/subscriptions/me', authenticate, async (req, res, next) => {
  try {
    const subscription = await SubscriptionRepo.findActiveByUserId(req.user.id)
    res.json({ subscription: subscription ?? null })
  } catch (err) {
    next(err)
  }
})

// GET /api/subscriptions/me/all — all of current user's subscriptions (history)
router.get('/subscriptions/me/all', authenticate, async (req, res, next) => {
  try {
    const subscriptions = await SubscriptionRepo.findByUserId(req.user.id)
    res.json({ subscriptions })
  } catch (err) {
    next(err)
  }
})

// POST /api/subscriptions/cancel — cancel current subscription (at period end)
router.post('/subscriptions/cancel', authenticate, validate({ body: SubscriptionCancelBody }), async (req, res, next) => {
  try {
    const { reason, feedback } = req.body || {}
    const subscription = await SubscriptionRepo.findActiveByUserId(req.user.id)
    if (!subscription?.stripe_subscription_id) {
      return res.status(404).json({ message: 'No active subscription found' })
    }

    const updated = await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: true,
    })

    await SubscriptionRepo.update(subscription.id, {
      cancel_at_period_end: true,
      current_period_end: new Date(updated.current_period_end * 1000),
      metadata: {
        ...(subscription.metadata || {}),
        cancellation_reason: reason || 'user_requested_cancellation',
        cancellation_feedback: feedback || null,
        cancellation_source: 'user_action',
        canceled_by: 'user',
        cancel_requested_at: new Date().toISOString(),
      },
    })

    res.json({ message: 'Subscription will cancel at period end', cancel_at_period_end: true })
  } catch (err) {
    next(err)
  }
})

// POST /api/subscriptions/upgrade — change plan
router.post('/subscriptions/upgrade', authenticate, validate({ body: SubscriptionUpgradeBody }), async (req, res, next) => {
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

// POST /api/subscriptions/discount — apply discount / promo code
router.post('/subscriptions/discount', authenticate, validate({ body: SubscriptionDiscountBody }), async (req, res, next) => {
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

// GET /api/subscriptions/plans — fetch active plans from Stripe (public)
// Products/prices configured in Stripe dashboard; this endpoint fetches them live.
// Returns empty list when STRIPE_SECRET_KEY is not configured.
router.get('/subscriptions/plans', async (req, res, next) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.json({ plans: [] })
  }

  try {
    const plans = await StripeService.getAvailablePlans()
    res.json({ plans })
  } catch (err) {
    next(err)
  }
})

module.exports = router
