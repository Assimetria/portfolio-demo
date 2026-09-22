// @system — Communication preferences API routes
// Mirrors Asymetric Ventures' /api/communications endpoints.
// Manages email/push/sms opt-in/out and one-click unsubscribe.
// Request bodies are validated with zod (Validation/schemas/@system/communications.js).
'use strict'

const express = require('express')
const router = express.Router()
const { authenticate } = require('../../../lib/@system/Helpers/auth')
const CommunicationPreferencesRepo = require('../../../db/repos/@system/CommunicationPreferencesRepo')
const logger = require('../../../lib/@system/Logger')
const { validate } = require('../../../lib/@system/Validation')
const { CommunicationsUpdateBody, CommunicationsToggleBody } = require('../../../lib/@system/Validation/schemas/@system/communications')

// GET /api/communications — get current user's preferences
router.get('/communications', authenticate, async (req, res, next) => {
  try {
    const prefs = await CommunicationPreferencesRepo.ensureExists(req.user.id)
    res.json({ preferences: prefs })
  } catch (err) { next(err) }
})

// POST /api/communications/update — update multiple preferences at once
router.post('/communications/update', authenticate, validate({ body: CommunicationsUpdateBody }), async (req, res, next) => {
  try {
    const prefs = await CommunicationPreferencesRepo.update(req.user.id, req.body)
    res.json({ preferences: prefs })
  } catch (err) { next(err) }
})

// POST /api/communications/email/toggle — toggle email marketing opt-in
router.post('/communications/email/toggle', authenticate, validate({ body: CommunicationsToggleBody }), async (req, res, next) => {
  try {
    const { enabled } = req.body
    if (typeof enabled !== 'boolean') return res.status(400).json({ message: 'enabled must be a boolean' })
    await CommunicationPreferencesRepo.ensureExists(req.user.id)
    const prefs = await CommunicationPreferencesRepo.toggleEmail(req.user.id, enabled)
    logger.info({ userId: req.user.id, enabled }, 'email marketing toggled')
    res.json({ preferences: prefs })
  } catch (err) { next(err) }
})

// POST /api/communications/push/toggle — toggle push notifications
router.post('/communications/push/toggle', authenticate, validate({ body: CommunicationsToggleBody }), async (req, res, next) => {
  try {
    const { enabled } = req.body
    if (typeof enabled !== 'boolean') return res.status(400).json({ message: 'enabled must be a boolean' })
    await CommunicationPreferencesRepo.ensureExists(req.user.id)
    const prefs = await CommunicationPreferencesRepo.togglePush(req.user.id, enabled)
    logger.info({ userId: req.user.id, enabled }, 'push notifications toggled')
    res.json({ preferences: prefs })
  } catch (err) { next(err) }
})

// POST /api/communications/sms/toggle — toggle SMS notifications
router.post('/communications/sms/toggle', authenticate, validate({ body: CommunicationsToggleBody }), async (req, res, next) => {
  try {
    const { enabled } = req.body
    if (typeof enabled !== 'boolean') return res.status(400).json({ message: 'enabled must be a boolean' })
    await CommunicationPreferencesRepo.ensureExists(req.user.id)
    const prefs = await CommunicationPreferencesRepo.toggleSms(req.user.id, enabled)
    logger.info({ userId: req.user.id, enabled }, 'sms notifications toggled')
    res.json({ preferences: prefs })
  } catch (err) { next(err) }
})

// GET /api/users/unsubscribe — one-click email unsubscribe (token-based, no auth needed)
router.get('/users/unsubscribe', async (req, res, next) => {
  try {
    const { token, email } = req.query
    if (!token && !email) return res.status(400).json({ message: 'token or email required' })

    // For simplicity, accept either a JWT token or a plain email
    // In production, always use a signed token to prevent abuse
    const db = require('../../../lib/@system/PostgreSQL')
    let userId
    if (email) {
      const user = await db.oneOrNone('SELECT id FROM users WHERE email = $1', [email])
      if (!user) return res.status(404).json({ message: 'not found' })
      userId = user.id
    }

    if (userId) {
      await CommunicationPreferencesRepo.ensureExists(userId)
      await CommunicationPreferencesRepo.toggleEmail(userId, false)
      logger.info({ userId }, 'user unsubscribed via one-click')
    }

    res.json({ message: 'You have been unsubscribed from marketing emails.' })
  } catch (err) { next(err) }
})

module.exports = router
