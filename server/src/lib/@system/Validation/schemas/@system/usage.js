// @system — zod request schemas for src/api/@system/usage/index.js
// Manual usage-event tracking body (service/operation/cost + optional tokens,
// bytes, metadata). Mirrors the usage_events insert in the handler.
const { z } = require('zod')

const NonNegInt = z.coerce.number().int().min(0)

// POST /usage/track
const UsageTrackBody = z.object({
  service: z.string().min(1, 'service is required').max(100),
  operation: z.string().min(1, 'operation is required').max(100),
  model: z.string().max(100).optional().nullable(),
  cost: z.coerce.number({ message: 'cost is required' }).min(0),
  tokens: z.object({
    input: NonNegInt.optional(),
    output: NonNegInt.optional(),
    total: NonNegInt.optional(),
  }).optional().nullable(),
  bytes: NonNegInt.optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
})

module.exports = { UsageTrackBody }
