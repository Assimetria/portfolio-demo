// @system — Integration status API
// Admin-only endpoints for inspecting which integrations are configured and healthy.
//
// GET  /api/integrations         — list all integration categories with health info
// GET  /api/integrations/:id     — details for a single integration category
// POST /api/integrations/:id/test — send a test event via the specified integration
//
// Request params/bodies are validated with zod (Validation/schemas/@system/integrations.js).

'use strict'

const express = require('express')
const router = express.Router()
const { authenticate, requireAdmin } = require('../../../lib/@system/Helpers/auth')
const Integrations = require('../../../lib/@system/Integrations')
const { integrationTestLimiter } = require('../../../lib/@system/RateLimit')
const { validate } = require('../../../lib/@system/Validation')
const { IntegrationIdParams, IntegrationTestBody } = require('../../../lib/@system/Validation/schemas/@system/integrations')

// ── GET /api/integrations ─────────────────────────────────────────────────────

router.get('/integrations', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const status = await Integrations.getStatus()
    res.json(status)
  } catch (err) {
    next(err)
  }
})

// ── GET /api/integrations/:id ─────────────────────────────────────────────────

router.get('/integrations/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const status = await Integrations.getStatus()
    const category = status.categories.find((c) => c.id === req.params.id)
    if (!category) return res.status(404).json({ message: `Integration "${req.params.id}" not found` })
    res.json(category)
  } catch (err) {
    next(err)
  }
})

// ── POST /api/integrations/:id/test ──────────────────────────────────────────
// Send a test event through the integration to verify it's working end-to-end.

router.post('/integrations/:id/test', authenticate, requireAdmin, integrationTestLimiter, validate({ params: IntegrationIdParams, body: IntegrationTestBody }), async (req, res, next) => {
  const { id } = req.params
  const appName = process.env.APP_NAME ?? 'App'

  try {
    let result

    switch (id) {
      case 'email': {
        const Email = require('../../../lib/@system/Email')
        const recipient = req.body.to ?? req.user?.email
        if (!recipient) return res.status(400).json({ message: 'No recipient — pass { to: "email" }' })
        result = await Email.sendNotificationEmail({
          to: recipient,
          subject: `Integration test from ${appName}`,
          title: 'Integration test',
          body: 'Email integration is working correctly.',
          userId: req.user?.id,
        })
        break
      }

      case 'notifications': {
        const NotificationAdapter = require('../../../lib/@system/NotificationAdapter')
        result = await NotificationAdapter.send({
          title: `Integration test — ${appName}`,
          body: 'Notification integration is working correctly.',
          level: 'info',
          metadata: { triggeredBy: req.user?.email ?? 'admin', env: process.env.NODE_ENV ?? 'development' },
        })
        break
      }

      case 'sms': {
        const SmsAdapter = require('../../../lib/@system/SmsAdapter')
        const to = req.body.to
        if (!to) return res.status(400).json({ message: 'SMS test requires { to: "+15551234567" }' })
        result = await SmsAdapter.send({
          to,
          body: `Integration test from ${appName}. SMS is working correctly.`,
        })
        break
      }

      case 'storage': {
        const StorageAdapter = require('../../../lib/@system/StorageAdapter')
        result = StorageAdapter.health()
        break
      }

      case 'search': {
        const SearchAdapter = require('../../../lib/@system/SearchAdapter')
        result = SearchAdapter.health()
        break
      }

      case 'payment': {
        const PaymentAdapter = require('../../../lib/@system/PaymentAdapter')
        // For payment we just list plans — safe read-only verification
        result = { provider: PaymentAdapter.provider, plans: await PaymentAdapter.listPlans() }
        break
      }

      default:
        return res.status(404).json({ message: `No test available for integration "${id}"` })
    }

    res.json({ success: true, integration: id, result })
  } catch (err) {
    next(err)
  }
})

module.exports = router
