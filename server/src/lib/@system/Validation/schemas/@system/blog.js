const { z } = require('zod')

// ── Blog ID Path Parameter ────────────────────────────────────────
const BlogIdParams = z.object({
  id: z.coerce.number({ invalid_type_error: 'id must be a number' })
    .int()
    .positive('id must be a positive integer'),
})

// ── Blog Slug Path Parameter ─────────────────────────────────────
const BlogSlugParams = z.object({
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens'),
})

// ── Public Blog List Query ────────────────────────────────────────
const BlogListQuery = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
})

// ── Admin Blog List Query ─────────────────────────────────────────
const AdminBlogListQuery = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(['draft', 'published', 'archived']).optional(),
})

module.exports = { BlogIdParams, BlogSlugParams, BlogListQuery, AdminBlogListQuery }
