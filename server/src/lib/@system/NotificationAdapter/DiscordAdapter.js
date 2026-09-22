// @system — Discord notification adapter implementation
// Required env vars:
//   DISCORD_WEBHOOK_URL — Discord webhook URL
'use strict'

const logger = require('../Logger')

const DiscordAdapter = {
  provider: 'discord',

  /**
   * Send a notification message to Discord.
   * @param {{ title: string, body: string, level?: 'info'|'warning'|'error', metadata?: Object }} opts
   * @returns {Promise<{ provider: string, ok: boolean }>}
   */
  async send({ title, body, level = 'info', metadata = {} }) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (!webhookUrl) throw Object.assign(new Error('DISCORD_WEBHOOK_URL is not configured'), { status: 500 })

    const colorMap = { info: 0x36a64f, warning: 0xffcc00, error: 0xff0000 }
    const color = colorMap[level] ?? colorMap.info

    const fields = Object.entries(metadata)
      .filter(([k]) => k !== 'app')
      .map(([k, v]) => ({ name: k, value: String(v), inline: true }))

    const embed = {
      title,
      description: body,
      color,
      fields,
      footer: { text: metadata.app ?? process.env.APP_NAME ?? 'App' },
      timestamp: new Date().toISOString(),
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    })

    // Discord returns 204 No Content on success
    if (res.status !== 200 && res.status !== 204) {
      const text = await res.text()
      logger.error({ status: res.status, body: text }, '[NotificationAdapter:discord] send failed')
      throw Object.assign(new Error(`Discord webhook failed: ${text}`), { status: res.status })
    }

    logger.info({ title, level }, '[NotificationAdapter:discord] notification sent')
    return { provider: 'discord', ok: true }
  },

  health() {
    return {
      provider: 'discord',
      configured: !!process.env.DISCORD_WEBHOOK_URL,
    }
  },
}

module.exports = DiscordAdapter
