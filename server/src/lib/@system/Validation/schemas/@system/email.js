// @system — zod request schemas for src/api/@system/email/index.js
// Admin test-email body. `template` stays a free string because the handler's
// switch falls back to the notification template for unknown values.
const { z } = require('zod')

// POST /email/test
const EmailTestBody = z.object({
  template: z.string().max(100).optional(),
  to: z.string().email('to must be a valid email address').max(320).optional().nullable(),
})

module.exports = { EmailTestBody }
