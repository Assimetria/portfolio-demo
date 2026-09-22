const { z } = require('zod')

const ActivityListQuery = z.object({
  resource_type: z.string().min(1).max(50).regex(/^[a-z_]+$/, 'resource_type must be lowercase alpha with underscores').optional(),
  action: z.string().min(1).max(100).regex(/^[a-z][a-z0-9_.]*$/, 'action must be lowercase alphanumeric with dots/underscores').optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
})

const CreateActivityBody = z.object({
  action: z.string().min(1).max(100).regex(/^[a-z][a-z0-9_.]*$/, 'action must be lowercase alphanumeric with dots/underscores'),
  resource_type: z.string().min(1).max(50).regex(/^[a-z_]+$/, 'resource_type must be lowercase alpha with underscores'),
  resource_id: z.string().max(255).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
})

module.exports = { ActivityListQuery, CreateActivityBody }
