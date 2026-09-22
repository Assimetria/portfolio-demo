// @system — zod request schemas for src/api/@system/payments/index.js
// Provider-agnostic checkout body (Stripe price id or Polar product-price id).
// The raw-body webhook route is intentionally not covered here.
const { z } = require('zod')

// POST /payments/checkout
const PaymentsCheckoutBody = z.object({
  priceId: z.string().min(1, 'priceId is required').max(200),
  trialDays: z.coerce.number().int().min(0).max(730).optional(),
})

module.exports = { PaymentsCheckoutBody }
