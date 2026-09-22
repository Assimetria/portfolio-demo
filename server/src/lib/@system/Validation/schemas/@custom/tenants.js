// @custom — zod request schemas for api/@custom/tenants.js
// Body/params validation for tenant creation and membership management.
// Used with the @system `validate()` middleware.

const { z } = require('zod')

const TENANT_ROLES = ['owner', 'admin', 'member']

const IdParam = z.coerce.number().int().positive('id must be a positive integer')

const CreateTenantBody = z.object({
  name: z.string().trim().min(1, 'name is required').max(100, 'name must be at most 100 characters'),
  // Optional explicit slug; the route slugifies it further.
  slug: z.string().trim().min(1).max(60).optional(),
})

const TenantIdParams = z.object({ id: IdParam })

const AddMemberBody = z.object({
  userId: z.coerce.number().int().positive('userId must be a positive integer'),
  role: z.enum(TENANT_ROLES).default('member'),
})

const RemoveMemberParams = z.object({
  id: IdParam,
  userId: IdParam,
})

module.exports = { TENANT_ROLES, CreateTenantBody, TenantIdParams, AddMemberBody, RemoveMemberParams }
