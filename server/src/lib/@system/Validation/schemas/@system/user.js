const { z } = require('zod')

const RegisterBody = z.object({
  email: z.string({ required_error: 'email is required' }).email('email must be a valid email address'),
  password: z.string({ required_error: 'password is required' }).min(1, 'password is required'),
  name: z.string().trim().optional(),
})

const UpdateProfileBody = z.object({
  name: z.string().trim().min(1, 'name must be a non-empty string').optional(),
})

const ChangePasswordBody = z.object({
  currentPassword: z.string({ required_error: 'currentPassword is required' }).min(1, 'currentPassword is required'),
  newPassword: z.string({ required_error: 'newPassword is required' }).min(1, 'newPassword is required'),
})

const PasswordResetRequestBody = z.object({
  email: z.string({ required_error: 'email is required' }).email('email must be a valid email address'),
})

const PasswordResetBody = z.object({
  token: z.string({ required_error: 'token is required' }).min(1, 'token is required'),
  password: z.string({ required_error: 'password is required' }).min(1, 'password is required'),
})

// Set-password (first-login provisioning) flow.
// Admin provisions a password-less account and emails a one-time token; the
// recipient completes the flow by choosing a password through SetPasswordBody.
const ProvisionUserBody = z.object({
  email: z.string({ required_error: 'email is required' }).email('email must be a valid email address'),
  name: z.string().trim().optional(),
})

const SetPasswordBody = z.object({
  token: z.string({ required_error: 'token is required' }).min(1, 'token is required'),
  password: z.string({ required_error: 'password is required' }).min(1, 'password is required'),
})

const VerifyEmailBody = z.object({
  token: z.string({ required_error: 'token is required' }).min(1, 'token is required'),
})

// PATCH /api/users/me/notifications — partial update; every key optional, values must be booleans.
// Keep in sync with NOTIFICATION_KEYS in api/@system/user/index.js.
const NOTIFICATION_KEYS = ['security', 'billing', 'activity', 'marketing', 'inApp', 'weeklyDigest', 'mentions']
const NotificationPrefsBody = z
  .object(Object.fromEntries(NOTIFICATION_KEYS.map((key) => [key, z.boolean(`${key} must be a boolean`).optional()])))
  .default({})

module.exports = {
  RegisterBody,
  UpdateProfileBody,
  ChangePasswordBody,
  PasswordResetRequestBody,
  PasswordResetBody,
  ProvisionUserBody,
  SetPasswordBody,
  VerifyEmailBody,
  NotificationPrefsBody,
}
