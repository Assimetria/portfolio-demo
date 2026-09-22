// @system — Twilio SMS adapter implementation
// Required env vars:
//   TWILIO_ACCOUNT_SID  — Twilio account SID
//   TWILIO_AUTH_TOKEN   — Twilio auth token
//   TWILIO_FROM         — Verified sender phone number (e.g. +15551234567)
'use strict'

const logger = require('../Logger')

const TWILIO_BASE = 'https://api.twilio.com/2010-04-01'

function twilioRequest(accountSid, authToken, path, body) {
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  const params = new URLSearchParams(body)
  return fetch(`${TWILIO_BASE}/Accounts/${accountSid}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })
}

const TwilioAdapter = {
  provider: 'twilio',

  /**
   * Send an SMS message.
   * @param {{ to: string, body: string, from?: string }} opts
   * @returns {Promise<{ provider: string, messageId: string, status: string }>}
   */
  async send({ to, body, from }) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken  = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = from ?? process.env.TWILIO_FROM

    if (!accountSid) throw Object.assign(new Error('TWILIO_ACCOUNT_SID is not configured'), { status: 500 })
    if (!authToken)  throw Object.assign(new Error('TWILIO_AUTH_TOKEN is not configured'), { status: 500 })
    if (!fromNumber) throw Object.assign(new Error('TWILIO_FROM is not configured'), { status: 500 })
    if (!to)         throw Object.assign(new Error('SMS recipient (to) is required'), { status: 400 })
    if (!body)       throw Object.assign(new Error('SMS body is required'), { status: 400 })

    const res = await twilioRequest(accountSid, authToken, '/Messages.json', {
      To:   to,
      From: fromNumber,
      Body: body,
    })

    const data = await res.json()

    if (!res.ok) {
      logger.error({ status: res.status, code: data.code, message: data.message }, '[SmsAdapter:twilio] send failed')
      throw Object.assign(new Error(data.message ?? 'Twilio SMS failed'), { status: res.status })
    }

    logger.info({ to, messageSid: data.sid, status: data.status }, '[SmsAdapter:twilio] SMS sent')
    return { provider: 'twilio', messageId: data.sid, status: data.status }
  },

  health() {
    return {
      provider: 'twilio',
      configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM),
      from: process.env.TWILIO_FROM ?? null,
    }
  },
}

module.exports = TwilioAdapter
