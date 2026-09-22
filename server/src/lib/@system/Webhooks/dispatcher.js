// @system — Webhook event dispatcher
// Sends HTTP POST requests to registered webhook endpoints when events occur.
// Signs payloads with HMAC-SHA256 using the per-webhook secret.
// Retries up to MAX_ATTEMPTS times with exponential backoff on transient failures.

const crypto = require('crypto')
const WebhookRepo = require('../../../db/repos/@system/WebhookRepo')
const logger = require('../Logger')

const MAX_ATTEMPTS = 3
const RETRY_BASE_DELAY_MS = 1_000 // 1s, 2s, 4s

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableStatus(status) {
  return status === null || status >= 500
}

// Available webhook event types
const WEBHOOK_EVENTS = [
  'user.created',
  'user.updated',
  'user.deleted',
  'subscription.created',
  'subscription.updated',
  'subscription.canceled',
  'payment.succeeded',
  'payment.failed',
  'team.created',
  'team.member_added',
  'team.member_removed',
  'api_key.created',
  'api_key.revoked',
  'blog.post_published',
  'file.uploaded',
]

function signPayload(payload, secret) {
  const body = JSON.stringify(payload)
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex')
  return { body, signature }
}

/**
 * Dispatch an event to all registered webhook endpoints.
 * Runs asynchronously — does not block the caller.
 *
 * Usage:
 *   const { dispatch } = require('../lib/@system/Webhooks/dispatcher')
 *   dispatch('user.created', { userId: 123, email: 'user@example.com' })
 */
async function dispatch(event, data) {
  try {
    const webhooks = await WebhookRepo.findActiveByEvent(event)
    if (webhooks.length === 0) return

    const payload = {
      event,
      data,
      timestamp: new Date().toISOString(),
    }

    const deliveries = webhooks.map((webhook) => deliverToWebhook(webhook, event, payload))
    await Promise.allSettled(deliveries)
  } catch (err) {
    logger.error({ err, event }, 'webhook dispatch failed')
  }
}

async function deliverToWebhook(webhook, event, payload) {
  const { body, signature } = signPayload(payload, webhook.secret)

  let lastStatus = null
  let lastResponse = ''
  let lastDurationMs = 0

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const startTime = Date.now()

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000) // 10s timeout

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-Event': event,
          'X-Webhook-Timestamp': payload.timestamp,
          'X-Webhook-Attempt': String(attempt),
        },
        body,
        signal: controller.signal,
      })

      clearTimeout(timeout)
      lastDurationMs = Date.now() - startTime
      lastStatus = response.status
      lastResponse = await response.text().catch(() => '')

      if (response.ok) {
        // Success — log and return
        WebhookRepo.logDelivery({
          webhookId: webhook.id,
          event,
          payload,
          status: lastStatus,
          response: lastResponse.slice(0, 1000),
          durationMs: lastDurationMs,
        }).catch(() => {})
        return
      }

      // Non-2xx response
      logger.warn(
        { webhookId: webhook.id, status: lastStatus, event, attempt },
        'webhook delivery failed'
      )

      if (!isRetryableStatus(lastStatus) || attempt === MAX_ATTEMPTS) break

    } catch (err) {
      lastDurationMs = Date.now() - startTime
      lastStatus = null
      lastResponse = err.message

      logger.warn(
        { webhookId: webhook.id, err: err.message, event, attempt },
        'webhook delivery error'
      )

      if (attempt === MAX_ATTEMPTS) break
    }

    // Exponential backoff before next attempt
    await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1))
  }

  // Log final failed delivery
  WebhookRepo.logDelivery({
    webhookId: webhook.id,
    event,
    payload,
    status: lastStatus,
    response: lastResponse.slice(0, 1000),
    durationMs: lastDurationMs,
  }).catch(() => {})
}

module.exports = { dispatch, WEBHOOK_EVENTS }
