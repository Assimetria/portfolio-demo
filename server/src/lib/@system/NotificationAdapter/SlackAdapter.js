// @system — Slack notification adapter implementation
// Required env vars:
//   SLACK_WEBHOOK_URL   — Slack incoming webhook URL
//   SLACK_CHANNEL       — Default channel (optional, overrides webhook default)
'use strict'

const logger = require('../Logger')

const SlackAdapter = {
  provider: 'slack',

  /**
   * Send a notification message to Slack.
   * @param {{ title: string, body: string, level?: 'info'|'warning'|'error', metadata?: Object }} opts
   * @returns {Promise<{ provider: string, ok: boolean }>}
   */
  async send({ title, body, level = 'info', metadata = {} }) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL
    if (!webhookUrl) throw Object.assign(new Error('SLACK_WEBHOOK_URL is not configured'), { status: 500 })

    const colorMap = { info: '#36a64f', warning: '#ffcc00', error: '#ff0000' }
    const color = colorMap[level] ?? colorMap.info

    const payload = {
      attachments: [
        {
          color,
          title,
          text: body,
          footer: metadata.app ?? process.env.APP_NAME ?? 'App',
          ts: Math.floor(Date.now() / 1000),
          fields: Object.entries(metadata)
            .filter(([k]) => k !== 'app')
            .map(([k, v]) => ({ title: k, value: String(v), short: true })),
        },
      ],
    }

    if (process.env.SLACK_CHANNEL) {
      payload.channel = process.env.SLACK_CHANNEL
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text()
      logger.error({ status: res.status, body: text }, '[NotificationAdapter:slack] send failed')
      throw Object.assign(new Error(`Slack webhook failed: ${text}`), { status: res.status })
    }

    logger.info({ title, level }, '[NotificationAdapter:slack] notification sent')
    return { provider: 'slack', ok: true }
  },

  health() {
    return {
      provider: 'slack',
      configured: !!process.env.SLACK_WEBHOOK_URL,
      channel: process.env.SLACK_CHANNEL ?? null,
    }
  },
}

module.exports = SlackAdapter
