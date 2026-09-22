const { z } = require('zod')

const CreateApiKeyBody = z.object({
  name: z.string({ required_error: 'name is required' }).trim().min(1, 'name is required'),
  expiresAt: z.string().datetime({ message: 'expiresAt must be a valid ISO 8601 datetime' }).optional().nullable(),
  scopes: z.array(z.string()).min(1, 'at least one scope is required').optional(),
  rateLimit: z.number().int().positive().max(10000).optional().nullable(),
})

const UpdateScopesBody = z.object({
  scopes: z.array(z.string()).min(1, 'at least one scope is required'),
})

const DeleteApiKeyParams = z.object({
  id: z.coerce.number({ invalid_type_error: 'id must be a number' }).int().positive('id must be a positive integer'),
})

module.exports = { CreateApiKeyBody, UpdateScopesBody, DeleteApiKeyParams }
