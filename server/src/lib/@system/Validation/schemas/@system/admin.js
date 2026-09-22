const { z } = require('zod')

const ListUsersQuery = z.object({
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'suspended', 'pending']).optional(),
})

const UserIdParams = z.object({
  id: z.coerce.number({ invalid_type_error: 'id must be a number' }).int().positive('id must be a positive integer'),
})

const UpdateUserRoleBody = z.object({
  role: z.enum(['user', 'admin'], { required_error: 'role is required', invalid_type_error: 'role must be "user" or "admin"' }),
})

const ListSubscriptionsQuery = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'canceled', 'past_due', 'trialing', 'incomplete', 'incomplete_expired', 'unpaid']).optional(),
})

const FeatureFlagKeyParams = z.object({
  key: z.string().min(1).max(100).regex(/^[a-z0-9._-]+$/i, 'key must be alphanumeric with dots, underscores, or hyphens'),
})

const CreateFeatureFlagBody = z.object({
  key: z.string().min(1).max(100).regex(/^[a-z0-9._-]+$/i, 'key must be alphanumeric with dots, underscores, or hyphens'),
  label: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
  enabled: z.boolean().default(false),
})

const UpdateFeatureFlagBody = z.object({
  enabled: z.boolean({ required_error: 'enabled is required', invalid_type_error: 'enabled must be a boolean' }),
})

// POST /api/admin/credits/:userId/adjust — signed integer credit adjustment with a mandatory note.
const CreditAdjustParams = z.object({
  userId: z.coerce.number().int('userId must be a positive integer').positive('userId must be a positive integer'),
})

const CreditAdjustBody = z.object({
  amount: z.coerce.number().int('amount must be a non-zero integer').refine((v) => v !== 0, 'amount must be a non-zero integer'),
  note: z.string().trim().min(1, 'note is required').max(500, 'note must be under 500 characters'),
})

module.exports = { ListUsersQuery, UserIdParams, UpdateUserRoleBody, ListSubscriptionsQuery, FeatureFlagKeyParams, CreateFeatureFlagBody, UpdateFeatureFlagBody, CreditAdjustParams, CreditAdjustBody }
