// @system — zod request schemas for api/@system/storage/index.js
// Bodies mirror what each handler destructures. `folder` is restricted to a single safe path segment
// because the upload-url handler concatenates it straight into the storage key. Image sizes/formats
// come from ImageProcessor so the enums cannot drift from what Sharp actually supports.
const { z } = require('zod')
const { SIZES } = require('../../../ImageProcessor')

const storageKey = z.string().min(1, 'key is required').max(1024, 'key must be at most 1024 characters')

const UploadUrlBody = z.object({
  filename: z.string().min(1, 'filename is required').max(255, 'filename must be at most 255 characters'),
  contentType: z.string().min(1, 'contentType is required').max(255, 'contentType must be at most 255 characters'),
  size: z.coerce.number().int('size must be an integer').positive('size must be a positive integer'),
  folder: z.string().regex(/^[a-zA-Z0-9_-]+$/, 'folder must contain only letters, digits, hyphens and underscores').max(64).default('uploads'),
  generateVariants: z.boolean().optional(),
})

const ConfirmUploadBody = z.object({
  key: storageKey,
  originalFilename: z.string().min(1, 'originalFilename is required').max(255, 'originalFilename must be at most 255 characters'),
  contentType: z.string().min(1, 'contentType is required').max(255, 'contentType must be at most 255 characters'),
  size: z.coerce.number().int('size must be an integer').nonnegative('size must be zero or greater'),
  metadata: z.record(z.string(), z.any()).optional(),
})

// /files/:key(*) — the param is a path; traversal is rejected downstream (StorageQuota/adapter), not here.
const FileKeyParams = z.object({
  key: storageKey,
})

const ProcessImageBody = z.object({
  key: storageKey,
  sizes: z.array(z.enum(Object.keys(SIZES))).min(1, 'sizes must contain at least one size').optional(),
  format: z.enum(['jpeg', 'png', 'webp', 'avif']).optional(),
})

module.exports = { UploadUrlBody, ConfirmUploadBody, FileKeyParams, ProcessImageBody }
