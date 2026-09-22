const { z } = require('zod')

const LoginBody = z.object({
  email: z.string({ required_error: 'email is required' }).email('email must be a valid email address'),
  password: z.string({ required_error: 'password is required' }).min(1, 'password is required'),
  totpCode: z.union([z.string(), z.number()]).optional(),
  rememberMe: z.boolean().optional(),
})

const DeleteSessionParams = z.object({
  id: z.coerce.number({ invalid_type_error: 'id must be a number' }).int().positive('id must be a positive integer'),
})

const RegisterBody = z.object({
  email: z.string({ required_error: 'email is required' }).email('email must be a valid email address'),
  password: z.string({ required_error: 'password is required' }).min(8, 'password must be at least 8 characters'),
  name: z.string().max(100).optional(),
})

module.exports = { LoginBody, RegisterBody, DeleteSessionParams }
