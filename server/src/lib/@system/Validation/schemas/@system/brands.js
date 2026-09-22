const { z } = require('zod')

// ─── Status enum ─────────────────────────────────────────────────────────────
const BrandStatus = z.enum(['active', 'draft', 'archived', 'deleted', 'inactive'])

// ─── ID Parameter Validation ─────────────────────────────────────────────────
const BrandIdParams = z.object({
  id: z.coerce.number().int().positive('Invalid brand ID'),
})

// ─── Pagination Query ────────────────────────────────────────────────────────
const BrandPaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).optional(),
  status: BrandStatus.optional(),
})

// ─── Hex colour ──────────────────────────────────────────────────────────────
const hexColor = z.string()
  .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Invalid hex color (#RGB or #RRGGBB)')
  .optional()
  .nullable()

// ─── Create Brand ────────────────────────────────────────────────────────────
const CreateBrandBody = z.object({
  name: z.string().min(1, 'Brand name is required').max(200).trim(),
  description: z.string().max(1000).optional().nullable(),
  image_url: z.string().url().max(500).optional().nullable(),
  website_url: z.string().url().max(500).optional().nullable(),
  primary_color: hexColor,
  secondary_color: hexColor,
  external_id: z.string().max(255).optional().nullable(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  metadata: z.record(z.unknown()).optional(),
  status: BrandStatus.optional().default('active'),
  subscription_id: z.number().int().positive().optional().nullable(),
})

// ─── Update Brand ────────────────────────────────────────────────────────────
const UpdateBrandBody = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(1000).optional().nullable(),
  image_url: z.string().url().max(500).optional().nullable(),
  website_url: z.string().url().max(500).optional().nullable(),
  primary_color: hexColor,
  secondary_color: hexColor,
  external_id: z.string().max(255).optional().nullable(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  metadata: z.record(z.unknown()).optional(),
  status: BrandStatus.optional(),
  subscription_id: z.number().int().positive().optional().nullable(),
})

// ─── Upload Logo ─────────────────────────────────────────────────────────────
const UploadLogoBody = z.object({
  logo: z.string()
    .regex(/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/, 'Invalid image data URL')
    .refine((data) => {
      const base64 = data.split(',')[1]?.length || 0
      return (base64 * 3) / 4 <= 2 * 1024 * 1024 // 2 MB
    }, { message: 'Logo must be less than 2MB' }),
})

module.exports = {
  BrandStatus,
  BrandIdParams,
  BrandPaginationQuery,
  CreateBrandBody,
  UpdateBrandBody,
  UploadLogoBody,
}
