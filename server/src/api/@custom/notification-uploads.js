// @custom — Notification file uploads API
// Endpoints for uploading and managing files attached to in-app notifications.
// Uses the existing StorageAdapter to generate presigned S3 URLs.
'use strict'

const express = require('express')
const router = express.Router()
const { z } = require('zod')

const db = require('../../lib/@system/PostgreSQL')
const StorageAdapter = require('../../lib/@system/StorageAdapter')
const { authenticate } = require('../../lib/@system/Helpers/auth')
const { validate } = require('../../lib/@system/Validation')
const logger = require('../../lib/@system/Logger')

// ── Zod schemas ──────────────────────────────────────────────────────────────

const UploadUrlBody = z.object({
  filename: z.string().min(1, 'filename is required').max(255),
  contentType: z.string().min(1, 'contentType is required').max(255),
  notificationId: z.coerce.number().int().positive(),
})

const ConfirmUploadBody = z.object({
  key: z.string().min(1, 'key is required').max(1024),
  notificationId: z.coerce.number().int().positive(),
  filename: z.string().min(1, 'filename is required').max(255),
  contentType: z.string().max(255).optional(),
  size: z.coerce.number().int().nonnegative(),
})

const NotificationIdParams = z.object({
  notificationId: z.coerce.number().int().positive(),
})

const FileIdParams = z.object({
  fileId: z.coerce.number().int().positive(),
})
// ── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/notification-uploads/upload-url
 *
 * Generate a presigned PUT URL for uploading a file associated with a
 * notification. The caller must be the recipient of the notification.
 *
 * Body: { filename, contentType, notificationId }
 */
router.post(
  '/notification-uploads/upload-url',
  authenticate,
  validate({ body: UploadUrlBody }),
  async (req, res, next) => {
    try {
      const { filename, contentType, notificationId } = req.body

      // Verify the notification belongs to the current user
      const notif = await db.oneOrNone(
        'SELECT id FROM notifications WHERE id = $1 AND user_id = $2',
        [notificationId, req.user.id],
      )
      if (!notif) {
        return res.status(404).json({ message: 'Notification not found or access denied' })
      }

      // Generate presigned upload URL — store in notifications/ folder on S3
      const uploadData = await StorageAdapter.createUploadUrl({
        filename,
        contentType,
        folder: 'notifications',
        expiresIn: 300, // 5 minutes
      })

      logger.info(
        { key: uploadData.key, notificationId, userId: req.user.id },
        '[notification-uploads] presigned URL created',
      )

      res.json({
        success: true,
        uploadUrl: uploadData.url,
        key: uploadData.key,
        publicUrl: uploadData.publicUrl,
        expiresAt: uploadData.expiresAt,
      })
    } catch (err) {
      next(err)
    }
  },
)
/**
 * POST /api/notification-uploads/confirm
 *
 * Confirm that a file was uploaded successfully and associate it with
 * the notification in the database.
 *
 * Body: { key, notificationId, filename, contentType?, size }
 */
router.post(
  '/notification-uploads/confirm',
  authenticate,
  validate({ body: ConfirmUploadBody }),
  async (req, res, next) => {
    try {
      const { key, notificationId, filename, contentType, size } = req.body

      // Verify the notification belongs to the current user
      const notif = await db.oneOrNone(
        'SELECT id FROM notifications WHERE id = $1 AND user_id = $2',
        [notificationId, req.user.id],
      )
      if (!notif) {
        return res.status(404).json({ message: 'Notification not found or access denied' })
      }

      // Verify the file actually exists in storage
      const exists = await StorageAdapter.exists(key)
      if (!exists.exists) {
        return res.status(404).json({
          success: false,
          error: 'File not found in storage. Please upload again.',
        })
      }

      // Insert a record in the notification_files table
      const file = await db.one(
        `INSERT INTO notification_files (notification_id, user_id, key, filename, content_type, size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, notification_id, key, filename, content_type, size_bytes, created_at`,
        [notificationId, req.user.id, key, filename, contentType || exists.contentType || '', size],
      )

      logger.info(
        { fileId: file.id, notificationId, key, userId: req.user.id },
        '[notification-uploads] file confirmed',
      )

      res.status(201).json({
        success: true,
        file: {
          id: file.id,
          notificationId: file.notification_id,
          key: file.key,
          filename: file.filename,
          contentType: file.content_type,
          sizeBytes: file.size_bytes,
          createdAt: file.created_at,
        },
      })
    } catch (err) {
      next(err)
    }
  },
)

/**
 * GET /api/notification-uploads/:notificationId
 *
 * List all files attached to a notification.
 */
router.get(
  '/notification-uploads/:notificationId',
  authenticate,
  validate({ params: NotificationIdParams }),
  async (req, res, next) => {
    try {
      const { notificationId } = req.params

      // Verify the notification belongs to the current user
      const notif = await db.oneOrNone(
        'SELECT id FROM notifications WHERE id = $1 AND user_id = $2',
        [notificationId, req.user.id],
      )
      if (!notif) {
        return res.status(404).json({ message: 'Notification not found or access denied' })
      }

      const files = await db.any(
        `SELECT id, notification_id, key, filename, content_type, size_bytes, created_at
         FROM notification_files
         WHERE notification_id = $1
         ORDER BY created_at DESC`,
        [notificationId],
      )

      // Build public URLs for each file
      const result = files.map((f) => ({
        id: f.id,
        notificationId: f.notification_id,
        key: f.key,
        filename: f.filename,
        contentType: f.content_type,
        sizeBytes: f.size_bytes,
        publicUrl: StorageAdapter.getPublicUrl(f.key),
        createdAt: f.created_at,
      }))

      res.json({ files: result })
    } catch (err) {
      next(err)
    }
  },
)

/**
 * DELETE /api/notification-uploads/:fileId
 *
 * Delete a file attached to a notification.
 * Only the notification owner can delete.
 */
router.delete(
  '/notification-uploads/:fileId',
  authenticate,
  validate({ params: FileIdParams }),
  async (req, res, next) => {
    try {
      const { fileId } = req.params

      // Find the file record and verify ownership
      const file = await db.oneOrNone(
        `SELECT nf.id, nf.key, nf.notification_id, n.user_id
         FROM notification_files nf
         JOIN notifications n ON n.id = nf.notification_id
         WHERE nf.id = $1`,
        [fileId],
      )
      if (!file) {
        return res.status(404).json({ message: 'File not found' })
      }
      if (file.user_id !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' })
      }

      // Delete from storage (fire-and-forget — non-critical)
      try {
        await StorageAdapter.delete(file.key)
      } catch (storageErr) {
        logger.warn({ err: storageErr, key: file.key }, '[notification-uploads] storage delete failed')
      }

      // Delete the database record
      await db.none('DELETE FROM notification_files WHERE id = $1', [fileId])

      logger.info({ fileId, notificationId: file.notification_id }, '[notification-uploads] file deleted')

      res.json({ success: true, message: 'File deleted' })
    } catch (err) {
      next(err)
    }
  },
)

module.exports = router