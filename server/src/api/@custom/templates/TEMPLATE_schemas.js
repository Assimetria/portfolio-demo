/**
 * API Template - Validation Schemas Reference
 *
 * This is a REFERENCE template showing how to define Zod validation schemas
 * for a resource. All code is commented out because it references example
 * types. Copy this pattern into `./schemas.js` next to your route file.
 */

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════
/*
Create schemas with Zod:

const { z } = require('zod')

const CreateResourceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.enum(['typeA', 'typeB', 'typeC']),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
})

const UpdateResourceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  category: z.enum(['typeA', 'typeB', 'typeC']).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
})

const ListResourcesSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  is_active: z.enum(['true', 'false']).optional(),
  sort: z.enum(['name', 'created_at', 'updated_at']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
})

const ResourceIdSchema = z.object({
  id: z.coerce.number().int().positive(),
})

module.exports = {
  CreateResourceSchema: { body: CreateResourceSchema },
  UpdateResourceSchema: { body: UpdateResourceSchema },
  ListResourcesSchema: { query: ListResourcesSchema },
  ResourceIdSchema: { params: ResourceIdSchema },
}
*/
