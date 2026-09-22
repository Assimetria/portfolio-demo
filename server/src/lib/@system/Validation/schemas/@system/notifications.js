// @system — zod request schemas for src/api/@system/notifications/index.js
// Integer :id param for the single-notification read/delete routes.
const { z } = require('zod')

// POST /notifications/:id/read, DELETE /notifications/:id
const NotificationIdParams = z.object({
  id: z.coerce.number().int().positive('id must be a positive integer'),
})

module.exports = { NotificationIdParams }
