// @system — zod request schemas for src/api/@system/polar/index.js
// Hosted-checkout body. The raw-body webhook route is intentionally not covered.
const { z } = require('zod')

// POST /polar/create-checkout-session
const PolarCheckoutBody = z.object({
  productPriceId: z.string().min(1, 'productPriceId is required').max(200),
})

module.exports = { PolarCheckoutBody }
