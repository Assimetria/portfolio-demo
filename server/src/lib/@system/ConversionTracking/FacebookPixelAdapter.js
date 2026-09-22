// @system — Facebook Pixel Conversion Tracking adapter
// Mirrors Asymetric Ventures' Facebook Pixel integration (server-side via Conversions API).
// Required env vars:
//   FACEBOOK_PIXEL_ID  — Pixel ID
//   FACEBOOK_SECRET    — Conversions API access token
'use strict'

const { createHash } = require('crypto')
const logger = require('../Logger')

const FB_API_VERSION = 'v23.0'
const FB_CURRENCY = 'USD'

function hash(str) {
  return createHash('sha256').update(str.trim().toLowerCase()).digest('hex')
}

function createBasePayload({ email, country, ip, userAgent, fbc, eventName }) {
  return {
    data: [{
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      user_data: {
        em: [hash(email)],
        country: country ? [hash(country)] : undefined,
        client_ip_address: ip,
        client_user_agent: userAgent,
        fbc,
      },
    }],
  }
}

async function post(payload) {
  const pixelId = process.env.FACEBOOK_PIXEL_ID
  const secret  = process.env.FACEBOOK_SECRET
  if (!secret || !pixelId) return null

  const url = `https://graph.facebook.com/${FB_API_VERSION}/${pixelId}/events?access_token=${secret}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Facebook API ${res.status}: ${text}`)
  }
  return res.json()
}

const FacebookPixelAdapter = {
  provider: 'facebook',

  isConfigured() {
    return !!(process.env.FACEBOOK_PIXEL_ID && process.env.FACEBOOK_SECRET)
  },

  async purchase({ price, email, country, ip, userAgent, fbc }) {
    try {
      const payload = createBasePayload({ email, country, ip, userAgent, fbc, eventName: 'Purchase' })
      const value = parseFloat(parseInt(price) / 100).toFixed(2)
      payload.data[0].custom_data = { currency: FB_CURRENCY, value: value === '0.00' ? '1.00' : value }
      const result = await post(payload)
      logger.info('[ConversionTracking:facebook] purchase tracked')
      return result
    } catch (err) {
      logger.error({ err }, '[ConversionTracking:facebook] purchase failed')
      return null
    }
  },

  async registration({ email, country, ip, userAgent, fbc }) {
    try {
      const payload = createBasePayload({ email, country, ip, userAgent, fbc, eventName: 'CompleteRegistration' })
      const result = await post(payload)
      logger.info('[ConversionTracking:facebook] registration tracked')
      return result
    } catch (err) {
      logger.error({ err }, '[ConversionTracking:facebook] registration failed')
      return null
    }
  },

  async subscribe({ price, email, country, ip, userAgent, fbc }) {
    try {
      const payload = createBasePayload({ email, country, ip, userAgent, fbc, eventName: 'Subscribe' })
      const value = parseFloat(parseInt(price) / 100).toFixed(2)
      payload.data[0].custom_data = { currency: FB_CURRENCY, value: value === '0.00' ? '1.00' : value }
      const result = await post(payload)
      logger.info('[ConversionTracking:facebook] subscribe tracked')
      return result
    } catch (err) {
      logger.error({ err }, '[ConversionTracking:facebook] subscribe failed')
      return null
    }
  },

  health() {
    return {
      provider: 'facebook',
      configured: this.isConfigured(),
      envVars: ['FACEBOOK_PIXEL_ID', 'FACEBOOK_SECRET'],
    }
  },
}

module.exports = FacebookPixelAdapter
