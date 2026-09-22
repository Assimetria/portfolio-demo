// @system — User-facing webhook management
// GET    /api/webhooks              — list your webhook endpoints
// POST   /api/webhooks              — register a webhook endpoint
// PATCH  /api/webhooks/:id          — update a webhook
// DELETE /api/webhooks/:id          — delete a webhook
// GET    /api/webhooks/:id/deliveries — delivery log for a webhook
// GET    /api/webhooks/events       — list available event types
// POST   /api/webhooks/:id/test     — send a test event
const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const { authenticate } = require('../../../lib/@system/Helpers/auth')
const WebhookRepo = require('../../../db/repos/@system/WebhookRepo')
const { WEBHOOK_EVENTS, dispatch } = require('../../../lib/@system/Webhooks/dispatcher')
const { validate } = require('../../../lib/@system/Validation')
const { z } = require('zod')

const CreateWebhookBody = z.object({
  url: z.string().url('url must be a valid URL'),
  events: z.array(z.string()).min(1, 'at least one event is required'),
  description: z.string().max(500).optional(),
})

const UpdateWebhookBody = z.object({
  url: z.string().url('url must be a valid URL').optional(),
  events: z.array(z.string()).min(1).optional(),
  description: z.string().max(500).optional().nullable(),
  active: z.boolean().optional(),
})

const WebhookIdParams = z.object({
  id: z.coerce.number().int().positive(),
})

// GET /api/webhooks/events — list available event types
router.get('/webhooks/events', authenticate, (req, res) => {
  res.json({ events: WEBHOOK_EVENTS })
})

// GET /api/webhooks — list
router.get('/webhooks', authenticate, async (req, res, next) => {
  try {
    const webhooks = await WebhookRepo.findAllByUser(req.user.id)
    res.json({ webhooks })
  } catch (err) {
    next(err)
  }
})

// POST /api/webhooks — create
router.post('/webhooks', authenticate, validate({ body: CreateWebhookBody }), async (req, res, next) => {
  try {
    const { url, events, description } = req.body
    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`

    const webhook = await WebhookRepo.create({
      userId: req.user.id,
      url,
      events,
      secret,
      description,
    })

    // Return secret only once at creation
    res.status(201).json({ webhook: { ...webhook, secret } })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/webhooks/:id — update
router.patch('/webhooks/:id', authenticate, validate({ params: WebhookIdParams, body: UpdateWebhookBody }), async (req, res, next) => {
  try {
    const updated = await WebhookRepo.update(req.params.id, req.user.id, req.body)
    if (!updated) return res.status(404).json({ message: 'Webhook not found' })
    res.json({ message: 'Webhook updated' })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/webhooks/:id — delete
router.delete('/webhooks/:id', authenticate, validate({ params: WebhookIdParams }), async (req, res, next) => {
  try {
    const deleted = await WebhookRepo.deleteById(req.params.id, req.user.id)
    if (!deleted) return res.status(404).json({ message: 'Webhook not found' })
    res.json({ message: 'Webhook deleted' })
  } catch (err) {
    next(err)
  }
})

// GET /api/webhooks/:id/deliveries — delivery log
router.get('/webhooks/:id/deliveries', authenticate, validate({ params: WebhookIdParams }), async (req, res, next) => {
  try {
    const deliveries = await WebhookRepo.getDeliveries(req.params.id, req.user.id)
    res.json({ deliveries })
  } catch (err) {
    next(err)
  }
})

// POST /api/webhooks/:id/test — send test event
router.post('/webhooks/:id/test', authenticate, validate({ params: WebhookIdParams }), async (req, res, next) => {
  try {
    const webhook = await WebhookRepo.findById(req.params.id, req.user.id)
    if (!webhook) return res.status(404).json({ message: 'Webhook not found' })

    await dispatch('test.ping', {
      message: 'This is a test webhook delivery',
      webhookId: webhook.id,
      timestamp: new Date().toISOString(),
    })

    res.json({ message: 'Test event dispatched' })
  } catch (err) {
    next(err)
  }
})

module.exports = router
