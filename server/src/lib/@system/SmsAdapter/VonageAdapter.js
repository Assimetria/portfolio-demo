// @system — Vonage (Nexmo) SMS adapter implementation
// Required env vars:
//   VONAGE_API_KEY      — Vonage API key
//   VONAGE_API_SECRET   — Vonage API secret
//   VONAGE_FROM         — Sender ID or phone number
'use strict'

const logger = require('../Logger')

const VonageAdapter = {
  provider: 'vonage',

  /**
   * Send an SMS message via Vonage.
   * @param {{ to: string, body: string, from?: string }} opts
   * @returns {Promise<{ provider: string, messageId: string, status: string }>}
   */
  async send({ to, body, from }) {
    const apiKey    = process.env.VONAGE_API_KEY
    const apiSecret = process.env.VONAGE_API_SECRET
    const sender    = from ?? process.env.VONAGE_FROM

    if (!apiKey)    throw Object.assign(new Error('VONAGE_API_KEY is not configured'), { status: 500 })
    if (!apiSecret) throw Object.assign(new Error('VONAGE_API_SECRET is not configured'), { status: 500 })
    if (!sender)    throw Object.assign(new Error('VONAGE_FROM is not configured'), { status: 500 })
    if (!to)        throw Object.assign(new Error('SMS recipient (to) is required'), { status: 400 })
    if (!body)      throw Object.assign(new Error('SMS body is required'), { status: 400 })

    const res = await fetch('https://rest.nexmo.com/sms/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key:    apiKey,
        api_secret: apiSecret,
        to,
        from: sender,
        text: body,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      logger.error({ status: res.status }, '[SmsAdapter:vonage] send failed')
      throw Object.assign(new Error('Vonage SMS request failed'), { status: res.status })
    }

    const msg = data.messages?.[0]
    if (msg?.status !== '0') {
      const errText = msg?.['error-text'] ?? 'Unknown Vonage error'
      logger.error({ vonageStatus: msg?.status, errText }, '[SmsAdapter:vonage] message error')
      throw Object.assign(new Error(errText), { status: 400 })
    }

    logger.info({ to, messageId: msg?.['message-id'] }, '[SmsAdapter:vonage] SMS sent')
    return { provider: 'vonage', messageId: msg?.['message-id'] ?? '', status: 'sent' }
  },

  health() {
    return {
      provider: 'vonage',
      configured: !!(process.env.VONAGE_API_KEY && process.env.VONAGE_API_SECRET && process.env.VONAGE_FROM),
      from: process.env.VONAGE_FROM ?? null,
    }
  },
}

module.exports = VonageAdapter
