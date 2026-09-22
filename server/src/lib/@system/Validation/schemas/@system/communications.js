// @system — zod request schemas for src/api/@system/communications/index.js
// Bulk preference update (keys mirror CommunicationPreferencesRepo.update's
// allow-list) and the { enabled } toggle body shared by email/push/sms.
const { z } = require('zod')

// POST /communications/update
const CommunicationsUpdateBody = z.object({
  email_marketing: z.boolean().optional(),
  product_updates: z.boolean().optional(),
  weekly_digest: z.boolean().optional(),
  in_app_notifications: z.boolean().optional(),
  sms_notifications: z.boolean().optional(),
  gdpr_consent: z.boolean().optional(),
})

// POST /communications/{email,push,sms}/toggle
const CommunicationsToggleBody = z.object({
  enabled: z.boolean({ message: 'enabled must be a boolean' }),
})

module.exports = { CommunicationsUpdateBody, CommunicationsToggleBody }
