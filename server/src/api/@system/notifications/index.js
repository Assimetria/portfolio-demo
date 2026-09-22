// @system — In-app notifications API
// Endpoints for listing, reading, and managing user notifications.
// Route params are validated with zod (Validation/schemas/@system/notifications.js).
'use strict'

const express = require('express')
const router = express.Router()
const { authenticate } = require('../../../lib/@system/Helpers/auth')
const NotificationRepo = require('../../../db/repos/@system/NotificationRepo')
const { validate } = require('../../../lib/@system/Validation')
const { NotificationIdParams } = require('../../../lib/@system/Validation/schemas/@system/notifications')

// GET /api/notifications — list user's notifications
router.get('/notifications', authenticate, async (req, res, next) => {
  try {
    const { limit = 50, offset = 0, unread } = req.query
    const notifications = await NotificationRepo.findByUserId(req.user.id, {
      limit: Math.min(Number(limit) || 50, 100),
      offset: Number(offset) || 0,
      unreadOnly: unread === 'true',
    })
    const unreadCount = await NotificationRepo.countUnread(req.user.id)
    res.json({ notifications, unreadCount })
  } catch (err) {
    next(err)
  }
})

// GET /api/notifications/unread-count — quick badge count
router.get('/notifications/unread-count', authenticate, async (req, res, next) => {
  try {
    const count = await NotificationRepo.countUnread(req.user.id)
    res.json({ count })
  } catch (err) {
    next(err)
  }
})

// POST /api/notifications/:id/read — mark single notification as read
router.post('/notifications/:id/read', authenticate, validate({ params: NotificationIdParams }), async (req, res, next) => {
  try {
    const notification = await NotificationRepo.markAsRead(req.params.id, req.user.id)
    if (!notification) return res.status(404).json({ message: 'Notification not found' })
    res.json({ notification })
  } catch (err) {
    next(err)
  }
})

// POST /api/notifications/read-all — mark all as read
router.post('/notifications/read-all', authenticate, async (req, res, next) => {
  try {
    await NotificationRepo.markAllAsRead(req.user.id)
    res.json({ message: 'All notifications marked as read' })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/notifications/read — delete all read notifications
// Must be registered BEFORE '/notifications/:id' or Express routes it to :id
// with id="read" (which now fails param validation with a 400).
router.delete('/notifications/read', authenticate, async (req, res, next) => {
  try {
    await NotificationRepo.deleteAllRead(req.user.id)
    res.json({ message: 'Read notifications cleared' })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/notifications/:id — delete a notification
router.delete('/notifications/:id', authenticate, validate({ params: NotificationIdParams }), async (req, res, next) => {
  try {
    const result = await NotificationRepo.deleteById(req.params.id, req.user.id)
    if (result.rowCount === 0) return res.status(404).json({ message: 'Notification not found' })
    res.json({ message: 'Notification deleted' })
  } catch (err) {
    next(err)
  }
})

module.exports = router
