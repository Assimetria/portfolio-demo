// @system — zod request schemas for src/api/@system/retention/index.js
// Optional { days } override for the admin audit-log purge (1..3650, matches
// MAX_RETENTION_DAYS in the route file). Coerces numeric strings like the handler.
const { z } = require('zod')

const MAX_RETENTION_DAYS = 3650

// POST /retention/cleanup
const RetentionCleanupBody = z.object({
  days: z.coerce.number()
    .int(`days must be an integer between 1 and ${MAX_RETENTION_DAYS}`)
    .min(1, `days must be an integer between 1 and ${MAX_RETENTION_DAYS}`)
    .max(MAX_RETENTION_DAYS, `days must be an integer between 1 and ${MAX_RETENTION_DAYS}`)
    .optional(),
})

module.exports = { RetentionCleanupBody }
