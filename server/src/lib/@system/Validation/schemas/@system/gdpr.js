// @system — zod request schemas for src/api/@system/gdpr/index.js
// Cookie-consent recording body (unauthenticated route, GDPR Art. 7).
const { z } = require('zod')

// POST /gdpr/consent
const GdprConsentBody = z.object({
  consent_value: z.enum(['essential', 'all'], { message: 'consent_value must be "essential" or "all"' }),
  session_id: z.string().max(255).optional().nullable(),
})

module.exports = { GdprConsentBody }
