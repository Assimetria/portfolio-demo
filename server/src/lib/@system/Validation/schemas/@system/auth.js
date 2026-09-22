// @system — zod request schemas for api/@system/auth/index.js (forgot-password / reset-password)
// Login/register on this router reuse schemas/@system/sessions.js. These two schemas run AFTER the
// route's field pre-checks, which produce the 400 messages pinned by test/api/@system/password-reset.test.js.
const { z } = require('zod')

const ForgotPasswordBody = z.object({
  email: z.string().trim().min(1, 'Email is required').max(320, 'email must be at most 320 characters'),
})

const ResetPasswordBody = z.object({
  token: z.string().min(1, 'token is required').max(255, 'token is too long'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

module.exports = { ForgotPasswordBody, ResetPasswordBody }
