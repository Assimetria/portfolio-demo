// @system — User-facing activity log API
// Returns audit_logs entries scoped to the authenticated user.
'use strict'

const express = require('express')
const router = express.Router()
const { authenticate, requireAdmin } = require('../../../lib/@system/Helpers/auth')
const db = require('../../../lib/@system/PostgreSQL')
const logger = require('../../../lib/@system/Logger')
const { validate } = require('../../../lib/@system/Validation')
const { ActivityListQuery, CreateActivityBody } = require('../../../lib/@system/Validation/schemas/@system/activity')

// GET /api/activity — list user's own activity
router.get('/activity', authenticate, validate({ query: ActivityListQuery }), async (req, res, next) => {
  try {
    const { limit, offset, resource_type, action } = req.query

    let where = 'WHERE user_id = $1'
    const params = [req.user.id]
    let idx = 2

    if (resource_type) {
      where += ` AND resource_type = $${idx++}`
      params.push(resource_type)
    }
    if (action) {
      where += ` AND action = $${idx++}`
      params.push(action)
    }

    params.push(limit, offset)

    const events = await db.any(
      `SELECT id, action, resource_type, resource_id, metadata, created_at
       FROM audit_logs ${where}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params,
    )

    const countRow = await db.one(
      `SELECT COUNT(*)::int AS total FROM audit_logs ${where}`,
      params.slice(0, -2), // exclude limit/offset
    )

    res.json({ events, total: countRow.total })
  } catch (err) {
    next(err)
  }
})

// POST /api/activity — log a custom activity event
router.post('/activity', authenticate, validate({ body: CreateActivityBody }), async (req, res, next) => {
  try {
    const { action, resource_type, resource_id, metadata } = req.body

    const event = await db.one(
      `INSERT INTO audit_logs (user_id, actor_email, action, resource_type, resource_id, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, action, resource_type, resource_id, metadata, created_at`,
      [
        req.user.id,
        req.user.email,
        action,
        resource_type,
        resource_id || null,
        req.ip,
        req.get('user-agent'),
        metadata ? JSON.stringify(metadata) : null,
      ],
    )

    res.status(201).json({ event })
  } catch (err) {
    next(err)
  }
})

module.exports = router
