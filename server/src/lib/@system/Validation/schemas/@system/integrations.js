// @system — zod request schemas for src/api/@system/integrations/index.js
// String :id param (integration category slug) and the optional { to } body
// used by the email (address) and sms (phone number) test cases.
const { z } = require('zod')

// POST /integrations/:id/test
const IntegrationIdParams = z.object({
  id: z.string().min(1, 'id is required').max(200),
})

const IntegrationTestBody = z.object({
  to: z.string().min(1).max(320).optional().nullable(),
})

module.exports = { IntegrationIdParams, IntegrationTestBody }
