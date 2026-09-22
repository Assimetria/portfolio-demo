/**
 * Storage API
 * 
 * Handles file uploads with:
 * - Presigned URL generation for direct browser uploads
 * - Storage quota enforcement
 * - Image optimization and variant generation
 * - File tracking and management
 */

'use strict'

const express = require('express')
const router = express.Router()

const StorageAdapter = require('../../../lib/@system/StorageAdapter')
const StorageQuota = require('../../../lib/@system/StorageQuota')
const ImageProcessor = require('../../../lib/@system/ImageProcessor')
const { validateFileMiddleware } = require('../../../lib/@system/StorageAdapter/validators')
const { authenticate, requireAdmin } = require('../../../lib/@system/Middleware')
const logger = require('../../../lib/@system/Logger')
const { validate } = require('../../../lib/@system/Validation')
const {
  UploadUrlBody,
  ConfirmUploadBody,
  FileKeyParams,
  ProcessImageBody,
} = require('../../../lib/@system/Validation/schemas/@system/storage')

/**
 * GET /api/storage/status
 * 
 * Get user's storage usage and quota
 */
router.get('/status',
  authenticate,
  async (req, res, next) => {
    try {
      const status = await StorageQuota.getStorageStatus(req.user.id)

      res.json({
        success: true,
        storage: status,
      })
    } catch (err) {
      next(err)
    }
  }
)

/**
 * POST /api/storage/upload-url
 * 
 * Request a presigned URL for direct browser-to-storage upload
 * 
 * Body: { filename, contentType, size, folder?, generateVariants? }
 */
router.post('/upload-url',
  authenticate,
  validateFileMiddleware({ allowedTypes: ['image', 'document', 'video'] }),
  StorageQuota.quotaCheckMiddleware,
  validate({ body: UploadUrlBody }),
  async (req, res, next) => {
    try {
      const { filename, contentType, size, folder = 'uploads', generateVariants = false } = req.body
      const userId = req.user.id

      // Generate unique key
      const timestamp = Date.now()
      const sanitized = filename.replace(/[^a-z0-9.-]/gi, '_')
      const storageKey = `${folder}/${userId}/${timestamp}-${sanitized}`

      // Get presigned upload URL
      const uploadData = await StorageAdapter.createUploadUrl({
        key: storageKey,
        contentType,
        expiresIn: 300, // 5 minutes
      })

      // Check if this is an image and variants are requested
      const isImage = contentType.startsWith('image/')
      const shouldProcessImage = isImage && (generateVariants || ImageProcessor.isSharpAvailable())

      // Prepare response
      const response = {
        success: true,
        uploadUrl: uploadData.url,
        fields: uploadData.fields,
        key: storageKey,
        expiresAt: uploadData.expiresAt,
        isImage,
        shouldProcessImage,
        storageStatus: req.storageStatus, // From quota check middleware
      }

      // Log for audit
      await req.auditLog('storage.upload_requested', 'file', storageKey, {
        filename,
        contentType,
        size,
        folder,
      })

      res.json(response)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * POST /api/storage/confirm
 * 
 * Confirm successful upload and track in database
 * 
 * Body: { key, originalFilename, contentType, size, metadata? }
 */
router.post('/confirm',
  authenticate,
  validate({ body: ConfirmUploadBody }),
  async (req, res, next) => {
    try {
      const { key, originalFilename, contentType, size, metadata = {} } = req.body

      // Verify file exists in storage
      const exists = await StorageAdapter.exists(key)
      if (!exists.exists) {
        return res.status(404).json({
          success: false,
          error: 'File not found in storage',
        })
      }

      // Track upload in database
      const file = await StorageQuota.trackUpload({
        userId: req.user.id,
        storageKey: key,
        originalFilename,
        contentType,
        sizeBytes: size,
        folder: key.split('/')[0],
        metadata,
      })

      // Get updated storage status
      const status = await StorageQuota.getStorageStatus(req.user.id)

      // Log for audit
      await req.auditLog('storage.upload_confirmed', 'file', key, {
        originalFilename,
        size,
      })

      res.json({
        success: true,
        file: {
          id: file.id,
          key: file.storage_key,
          filename: file.original_filename,
          contentType: file.content_type,
          size: file.size_bytes,
          createdAt: file.created_at,
          url: StorageAdapter.getPublicUrl(key),
        },
        storage: status,
      })
    } catch (err) {
      next(err)
    }
  }
)

/**
 * GET /api/storage/files
 * 
 * List user's uploaded files
 * 
 * Query: ?limit=50&offset=0&folder=uploads&contentType=image%
 */
router.get('/files',
  authenticate,
  async (req, res, next) => {
    try {
      const {
        limit = 50,
        offset = 0,
        folder,
        contentType,
      } = req.query

      const files = await StorageQuota.getUserFiles(req.user.id, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        folder,
        contentType,
      })

      // Add public URLs
      const filesWithUrls = files.map(file => ({
        ...file,
        url: StorageAdapter.getPublicUrl(file.storage_key),
      }))

      res.json({
        success: true,
        files: filesWithUrls,
        count: files.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
      })
    } catch (err) {
      next(err)
    }
  }
)

/**
 * DELETE /api/storage/files/:key
 * 
 * Delete a file
 * 
 * Params: key - Storage key (URL-encoded)
 */
router.delete('/files/:key(*)',
  authenticate,
  validate({ params: FileKeyParams }),
  async (req, res, next) => {
    try {
      const key = decodeURIComponent(req.params.key)

      // Delete file (soft delete in DB, hard delete in storage)
      const deleted = await StorageQuota.deleteFile(key, req.user.id, true)

      // Get updated storage status
      const status = await StorageQuota.getStorageStatus(req.user.id)

      // Log for audit
      await req.auditLog('storage.file_deleted', 'file', key, {
        filename: deleted.original_filename,
        size: deleted.size_bytes,
      })

      res.json({
        success: true,
        message: 'File deleted successfully',
        storage: status,
      })
    } catch (err) {
      next(err)
    }
  }
)

/**
 * POST /api/storage/process-image
 * 
 * Process an already-uploaded image (generate variants, optimize, etc.)
 * 
 * Body: { key, sizes: ['thumbnail', 'small', 'medium'], format: 'webp' }
 */
router.post('/process-image',
  authenticate,
  validate({ body: ProcessImageBody }),
  async (req, res, next) => {
    try {
      if (!ImageProcessor.isSharpAvailable()) {
        return res.status(503).json({
          success: false,
          error: 'Image processing not available (Sharp not installed)',
        })
      }

      const { key, sizes = ['thumbnail', 'small', 'medium'], format = 'webp' } = req.body

      // Verify file belongs to user
      const files = await StorageQuota.getUserFiles(req.user.id, {
        limit: 1,
        offset: 0,
      })

      const file = files.find(f => f.storage_key === key)
      if (!file) {
        return res.status(404).json({
          success: false,
          error: 'File not found or access denied',
        })
      }

      // Check if image
      if (!file.content_type.startsWith('image/')) {
        return res.status(400).json({
          success: false,
          error: 'File is not an image',
        })
      }

      // Download original image
      const downloadUrl = await StorageAdapter.createDownloadUrl({ key })
      const response = await fetch(downloadUrl.url)
      const buffer = Buffer.from(await response.arrayBuffer())

      // Process image
      const processed = await ImageProcessor.processUpload(buffer, {
        generateVariants: true,
        sizes,
        format,
      })

      // Upload variants
      const variantKeys = {}
      for (const [sizeName, variantBuffer] of Object.entries(processed)) {
        if (sizeName === 'original') continue

        const variantKey = key.replace(/\.[^.]+$/, `-${sizeName}.${format}`)
        const uploadData = await StorageAdapter.createUploadUrl({
          key: variantKey,
          contentType: `image/${format}`,
        })

        // Upload variant
        await fetch(uploadData.url, {
          method: 'PUT',
          body: variantBuffer,
          headers: {
            'Content-Type': `image/${format}`,
          },
        })

        variantKeys[sizeName] = variantKey
      }

      // Log for audit
      await req.auditLog('storage.image_processed', 'file', key, {
        sizes,
        format,
        variants: Object.keys(variantKeys).length,
      })

      res.json({
        success: true,
        original: key,
        variants: variantKeys,
        variantUrls: Object.fromEntries(
          Object.entries(variantKeys).map(([size, k]) => [size, StorageAdapter.getPublicUrl(k)])
        ),
      })
    } catch (err) {
      next(err)
    }
  }
)

/**
 * GET /api/storage/stats (Admin only)
 * 
 * Get system-wide storage statistics
 */
router.get('/stats',
  authenticate,
  requireAdmin,
  async (req, res, next) => {
    try {
      const stats = await StorageQuota.getSystemStats()

      res.json({
        success: true,
        stats,
      })
    } catch (err) {
      next(err)
    }
  }
)

module.exports = router
