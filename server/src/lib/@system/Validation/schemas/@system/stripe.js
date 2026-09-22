// @system — zod request schemas for src/api/@system/stripe/index.js
// Checkout, cancel, upgrade, metered usage and discount bodies.
// The raw-body /stripe/webhook route is intentionally not covered here.
const { z } = require('zod')

const PriceId = z.string().min(1, 'priceId is required').max(200)
// Handler does Number(trialDays) > 0, so accept numeric strings too.
const TrialDays = z.coerce.number().int().min(0).max(730).optional()

// POST /stripe/create-checkout-session, POST /stripe/create-metered-checkout
const StripeCheckoutBody = z.object({
  priceId: PriceId,
  trialDays: TrialDays,
})

// POST /stripe/cancel-subscription — both fields optional, stored in metadata
const StripeCancelBody = z.object({
  reason: z.string().max(500).optional().nullable(),
  feedback: z.string().max(5000).optional().nullable(),
})

// POST /stripe/upgrade-subscription
const StripeUpgradeBody = z.object({
  priceId: PriceId,
})

// POST /stripe/report-usage — forwarded to stripe.subscriptionItems.createUsageRecord
const StripeReportUsageBody = z.object({
  quantity: z.coerce.number().int().positive('quantity is required (positive integer)'),
  action: z.enum(['increment', 'set']).optional(),
})

// POST /stripe/apply-discount
const StripeDiscountBody = z.object({
  discountCode: z.string().min(1, 'discountCode is required').max(100),
})

module.exports = {
  StripeCheckoutBody,
  StripeCancelBody,
  StripeUpgradeBody,
  StripeReportUsageBody,
  StripeDiscountBody,
}
