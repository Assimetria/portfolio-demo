const { z } = require('zod')

// ── Contact form submission (POST /api/contact) ──────────────────────────
// `website` is a honeypot: rendered off-screen by the client form, never
// filled by humans. Any non-empty value is rejected by the route (not here)
// so that bots receive a plausible 400 rather than a schema hint.
// `turnstileToken` is the Cloudflare Turnstile response; the route only
// requires it when Turnstile is enforced (see api/@system/contact/config.js).
const trimmed = (max) => z.string().trim().max(max)

const ContactSubmissionBody = z.object({
  name: trimmed(120).min(2, 'Name must be at least 2 characters'),
  email: trimmed(254).email('A valid email address is required'),
  phone: trimmed(40).optional().or(z.literal('')),
  subject: trimmed(200).optional().or(z.literal('')),
  message: trimmed(5000).min(10, 'Message must be at least 10 characters'),
  website: z.string().max(200).optional().or(z.literal('')), // honeypot
  sourcePath: trimmed(500).optional().or(z.literal('')),
  turnstileToken: z.string().max(4096).optional().or(z.literal('')),
})

// ── Admin list query (GET /api/contact) ──────────────────────────────────
const ContactListQuery = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  unread: z
    .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true' || v === '1')),
})

// ── Path param (PATCH /api/contact/:id/read|unread, DELETE /api/contact/:id) ─
const ContactIdParams = z.object({
  id: z.coerce.number({ invalid_type_error: 'id must be a number' }).int().positive('id must be a positive integer'),
})

module.exports = { ContactSubmissionBody, ContactListQuery, ContactIdParams }
