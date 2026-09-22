/**
 * Storage Quota Management System
 * 
 * Tracks file uploads per user and enforces storage limits.
 * Integrates with StorageAdapter for complete file lifecycle management.
 */

'use strict'

const db = require('../PostgreSQL')
const logger = require('../Logger')
const StorageAdapter = require('../StorageAdapter')

// Default quotas in bytes
const DEFAULT_QUOTAS = {
  FREE: 100 * 1024 * 1024,      // 100MB
  PRO: 10 * 1024 * 1024 * 1024, // 10GB
  ENTERPRISE: 100 * 1024 * 1024 * 1024, // 100GB
}

/**
 * Get user's storage status (usage + quota)
 * 
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Storage status
 */
async function getStorageStatus(userId) {
  try {
    const result = await db.oneOrNone(
      'SELECT * FROM get_storage_status($1)',
      [userId]
    )

    if (!result) {
      return {
        usedBytes: 0,
        quotaBytes: DEFAULT_QUOTAS.FREE,
        usedMb: 0,
        quotaMb: Math.round(DEFAULT_QUOTAS.FREE / (1024 * 1024)),
        percentage: 0,
        availableBytes: DEFAULT_QUOTAS.FREE,
        isOverQuota: false,
      }
    }

    return {
      usedBytes: parseInt(result.used_bytes),
      quotaBytes: parseInt(result.quota_bytes),
      usedMb: parseFloat(result.used_mb),
      quotaMb: parseFloat(result.quota_mb),
      percentage: parseFloat(result.percentage),
      availableBytes: parseInt(result.available_bytes),
      isOverQuota: result.is_over_quota,
    }
  } catch (err) {
    logger.error({ err, userId }, '[StorageQuota] Failed to get storage status')
    throw err
  }
}

/**
 * Check if user can upload a file of given size
 * 
 * @param {number} userId - User ID
 * @param {number} fileSize - File size in bytes
 * @returns {Promise<{allowed: boolean, reason?: string, status: Object}>}
 */
async function canUpload(userId, fileSize) {
  const status = await getStorageStatus(userId)

  if (status.isOverQuota) {
    return {
      allowed: false,
      reason: 'Storage quota exceeded',
      status,
    }
  }

  if (status.availableBytes < fileSize) {
    return {
      allowed: false,
      reason: `File size (${formatBytes(fileSize)}) exceeds available storage (${formatBytes(status.availableBytes)})`,
      status,
    }
  }

  return {
    allowed: true,
    status,
  }
}

/**
 * Track a new file upload
 * 
 * @param {Object} options - Upload details
 * @param {number} options.userId - User ID
 * @param {string} options.storageKey - Storage key/path
 * @param {string} options.originalFilename - Original filename
 * @param {string} options.contentType - MIME type
 * @param {number} options.sizeBytes - File size in bytes
 * @param {string} options.folder - Storage folder (default: 'uploads')
 * @param {Object} options.metadata - Additional metadata
 * @returns {Promise<Object>} Created file record
 */
async function trackUpload({
  userId,
  storageKey,
  originalFilename,
  contentType,
  sizeBytes,
  folder = 'uploads',
  metadata = {},
}) {
  try {
    // Check quota before tracking
    const check = await canUpload(userId, sizeBytes)
    if (!check.allowed) {
      throw new Error(check.reason)
    }

    const file = await db.one(
      `INSERT INTO file_uploads 
       (user_id, storage_key, original_filename, content_type, size_bytes, folder, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, storageKey, originalFilename, contentType, sizeBytes, folder, JSON.stringify(metadata)]
    )

    logger.info({
      userId,
      storageKey,
      sizeBytes,
      filename: originalFilename,
    }, '[StorageQuota] File upload tracked')

    return file
  } catch (err) {
    logger.error({ err, userId, storageKey }, '[StorageQuota] Failed to track upload')
    throw err
  }
}

/**
 * Mark a file as deleted (soft delete)
 * 
 * @param {string} storageKey - Storage key to delete
 * @param {number} userId - User ID (for verification)
 * @param {boolean} hardDelete - If true, also delete from storage adapter
 * @returns {Promise<Object>} Deleted file record
 */
async function deleteFile(storageKey, userId, hardDelete = true) {
  try {
    // Soft delete in database
    const file = await db.oneOrNone(
      `UPDATE file_uploads
       SET deleted_at = NOW()
       WHERE storage_key = $1 AND user_id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [storageKey, userId]
    )

    if (!file) {
      throw new Error('File not found or already deleted')
    }

    // Hard delete from storage if requested
    if (hardDelete) {
      await StorageAdapter.delete(storageKey)
    }

    logger.info({
      userId,
      storageKey,
      hardDelete,
    }, '[StorageQuota] File deleted')

    return file
  } catch (err) {
    logger.error({ err, storageKey, userId }, '[StorageQuota] Failed to delete file')
    throw err
  }
}

/**
 * Get user's uploaded files
 * 
 * @param {number} userId - User ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Max results (default: 50)
 * @param {number} options.offset - Pagination offset (default: 0)
 * @param {string} options.folder - Filter by folder
 * @param {string} options.contentType - Filter by content type pattern
 * @param {boolean} options.includeDeleted - Include soft-deleted files
 * @returns {Promise<Array>} File records
 */
async function getUserFiles(userId, options = {}) {
  const {
    limit = 50,
    offset = 0,
    folder,
    contentType,
    includeDeleted = false,
  } = options

  const conditions = ['user_id = $1']
  const params = [userId]
  let paramIndex = 2

  if (!includeDeleted) {
    conditions.push('deleted_at IS NULL')
  }

  if (folder) {
    conditions.push(`folder = $${paramIndex++}`)
    params.push(folder)
  }

  if (contentType) {
    conditions.push(`content_type LIKE $${paramIndex++}`)
    params.push(contentType)
  }

  const query = `
    SELECT * FROM file_uploads
    WHERE ${conditions.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `

  params.push(limit, offset)

  try {
    return await db.any(query, params)
  } catch (err) {
    logger.error({ err, userId, options }, '[StorageQuota] Failed to get user files')
    throw err
  }
}

/**
 * Set user's storage quota
 * 
 * @param {number} userId - User ID
 * @param {number} quotaBytes - Quota in bytes
 * @returns {Promise<Object>} Updated quota record
 */
async function setQuota(userId, quotaBytes) {
  try {
    if (quotaBytes <= 0) {
      throw new Error('Quota must be positive')
    }

    const quota = await db.one(
      `INSERT INTO storage_quotas (user_id, quota_bytes)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE
       SET quota_bytes = $2, updated_at = NOW()
       RETURNING *`,
      [userId, quotaBytes]
    )

    logger.info({
      userId,
      quotaBytes,
      quotaMb: Math.round(quotaBytes / (1024 * 1024)),
    }, '[StorageQuota] Quota updated')

    return quota
  } catch (err) {
    logger.error({ err, userId, quotaBytes }, '[StorageQuota] Failed to set quota')
    throw err
  }
}

/**
 * Set quota based on plan tier
 * 
 * @param {number} userId - User ID
 * @param {string} tier - Plan tier ('FREE', 'PRO', 'ENTERPRISE')
 * @returns {Promise<Object>} Updated quota record
 */
async function setQuotaByTier(userId, tier) {
  const quotaBytes = DEFAULT_QUOTAS[tier.toUpperCase()]
  if (!quotaBytes) {
    throw new Error(`Unknown tier: ${tier}`)
  }

  return setQuota(userId, quotaBytes)
}

/**
 * Clean up abandoned uploads (older than specified time, not yet tracked)
 * This would run as a scheduled task
 * 
 * @param {number} olderThanHours - Delete untracked files older than X hours
 * @returns {Promise<number>} Number of files cleaned
 */
async function cleanAbandonedUploads(olderThanHours = 24) {
  logger.info({ olderThanHours }, '[StorageQuota] Cleaning abandoned uploads...')

  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000)

  // Fetch all storage keys ever tracked in DB (including soft-deleted)
  // so we don't delete files that belong to known records
  const trackedRows = await db.any('SELECT storage_key FROM file_uploads')
  const trackedKeys = new Set(trackedRows.map((r) => r.storage_key))

  // Enumerate every object currently in storage
  let storageObjects
  try {
    storageObjects = await StorageAdapter.list()
  } catch (err) {
    logger.error({ err }, '[StorageQuota] Failed to list storage objects — aborting cleanup')
    return 0
  }

  let cleaned = 0
  for (const obj of storageObjects) {
    // Skip files that have a DB record (tracked, regardless of deletion status)
    if (trackedKeys.has(obj.key)) continue

    // Skip files that are too recent — they may be mid-upload
    if (obj.lastModified >= cutoff) continue

    try {
      await StorageAdapter.delete(obj.key)
      cleaned++
      logger.info(
        { key: obj.key, lastModified: obj.lastModified, sizeBytes: obj.size },
        '[StorageQuota] Deleted orphaned file'
      )
    } catch (err) {
      logger.error({ err, key: obj.key }, '[StorageQuota] Failed to delete orphaned file')
    }
  }

  logger.info({ cleaned, scanned: storageObjects.length }, '[StorageQuota] Cleanup complete')
  return cleaned
}

/**
 * Get total storage statistics (admin)
 * 
 * @returns {Promise<Object>} System-wide storage stats
 */
async function getSystemStats() {
  try {
    const stats = await db.one(`
      SELECT 
        COUNT(DISTINCT user_id) as total_users,
        COUNT(*) as total_files,
        SUM(size_bytes) as total_bytes,
        ROUND(SUM(size_bytes) / (1024.0 * 1024.0), 2) as total_mb,
        ROUND(SUM(size_bytes) / (1024.0 * 1024.0 * 1024.0), 2) as total_gb,
        ROUND(AVG(size_bytes), 0) as avg_file_size,
        MAX(size_bytes) as max_file_size,
        MIN(created_at) as oldest_file,
        MAX(created_at) as newest_file
      FROM file_uploads
      WHERE deleted_at IS NULL
    `)

    return {
      totalUsers: parseInt(stats.total_users),
      totalFiles: parseInt(stats.total_files),
      totalBytes: parseInt(stats.total_bytes),
      totalMb: parseFloat(stats.total_mb),
      totalGb: parseFloat(stats.total_gb),
      avgFileSize: parseInt(stats.avg_file_size),
      maxFileSize: parseInt(stats.max_file_size),
      oldestFile: stats.oldest_file,
      newestFile: stats.newest_file,
    }
  } catch (err) {
    logger.error({ err }, '[StorageQuota] Failed to get system stats')
    throw err
  }
}

/**
 * Format bytes to human-readable format
 * 
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string (e.g., "1.5 MB")
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Express middleware to check storage quota before upload
 */
function quotaCheckMiddleware(req, res, next) {
  // This middleware should be used on upload endpoints
  const { size } = req.body

  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  canUpload(req.user.id, size)
    .then((check) => {
      if (!check.allowed) {
        return res.status(413).json({
          error: 'Storage quota exceeded',
          message: check.reason,
          status: check.status,
        })
      }

      // Attach status to request for use in route handler
      req.storageStatus = check.status
      next()
    })
    .catch((err) => {
      logger.error({ err, userId: req.user.id }, '[StorageQuota] Quota check failed')
      next(err)
    })
}

module.exports = {
  getStorageStatus,
  canUpload,
  trackUpload,
  deleteFile,
  getUserFiles,
  setQuota,
  setQuotaByTier,
  cleanAbandonedUploads,
  getSystemStats,
  formatBytes,
  quotaCheckMiddleware,
  DEFAULT_QUOTAS,
}
