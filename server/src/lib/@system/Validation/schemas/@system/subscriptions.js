// @system — zod request schemas for src/api/@system/subscriptions/index.js
// Cancel (optional reason/feedback), upgrade (priceId) and discount-code bodies.
const { z } = require('zod')

// POST /subscriptions/cancel
const SubscriptionCancelBody = z.object({
  reason: z.string().max(500).optional().nullable(),
  feedback: z.string().max(5000).optional().nullable(),
})

// POST /subscriptions/upgrade
const SubscriptionUpgradeBody = z.object({
  priceId: z.string().min(1, 'priceId is required').max(200),
})

// POST /subscriptions/discount
const SubscriptionDiscountBody = z.object({
  discountCode: z.string().min(1, 'discountCode is required').max(100),
})

module.exports = { SubscriptionCancelBody, SubscriptionUpgradeBody, SubscriptionDiscountBody }
