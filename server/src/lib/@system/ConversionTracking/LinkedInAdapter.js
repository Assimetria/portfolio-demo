// @system — LinkedIn Conversion Tracking adapter
// Mirrors Asymetric Ventures' LinkedIn Pixel integration.
// Required env vars:
//   LINKEDIN_API_SECRET     — Bearer token
//   LINKEDIN_CONVERSION_ID  — Conversion rule ID or URN
//   LINKEDIN_AD_ACCOUNT_ID  — Sponsored account ID or URN
'use strict'

const { createHash } = require('crypto')
const logger = require('../Logger')

const LINKEDIN_API_VERSION = '202411'
const LINKEDIN_CURRENCY = 'USD'
const CONVERSION_EVENTS_ENDPOINT = 'https://api.linkedin.com/rest/conversionEvents'

function hash(str) {
  if (!str) return null
  return createHash('sha256').update(str.toLowerCase().trim()).digest('hex')
}

function formatUrn(id, type) {
  if (!id) return null
  return id.startsWith('urn:') ? id : `urn:${type}:${id}`
}

function createBasePayload({ email, country, firstName, lastName, li_fat_id }) {
  const conversionId = process.env.LINKEDIN_CONVERSION_ID
  const userIds = []

  if (email) userIds.push({ idType: 'SHA256_EMAIL', idValue: hash(email) })
  if (li_fat_id) userIds.push({ idType: 'LINKEDIN_FIRST_PARTY_ADS_TRACKING_UUID', idValue: li_fat_id })

  const payload = {
    conversion: formatUrn(conversionId, 'lla:llaPartnerConversion'),
    conversionHappenedAt: Date.now(),
    user: { userIds },
  }

  if (firstName && lastName) {
    payload.user.userInfo = {
      firstName: firstName.toLowerCase().trim(),
      lastName: lastName.toLowerCase().trim(),
    }
    if (country) payload.user.userInfo.countryCode = country.toUpperCase()
  }

  return payload
}

async function post(payload) {
  const token = process.env.LINKEDIN_API_SECRET
  if (!token) return null

  const res = await fetch(CONVERSION_EVENTS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': LINKEDIN_API_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LinkedIn API ${res.status}: ${text}`)
  }
  return res.json()
}

const LinkedInAdapter = {
  provider: 'linkedin',

  isConfigured() {
    return !!(process.env.LINKEDIN_API_SECRET && process.env.LINKEDIN_CONVERSION_ID)
  },

  async purchase({ price, email, country, firstName, lastName, li_fat_id }) {
    try {
      const payload = createBasePayload({ email, country, firstName, lastName, li_fat_id })
      const value = parseFloat(parseInt(price) / 100).toFixed(2)
      payload.conversionValue = { currencyCode: LINKEDIN_CURRENCY, amount: value === '0.00' ? '1.00' : value }
      payload.eventId = `purchase_${email}_${Date.now()}`
      const result = await post(payload)
      logger.info('[ConversionTracking:linkedin] purchase tracked')
      return result
    } catch (err) {
      logger.error({ err }, '[ConversionTracking:linkedin] purchase failed')
      return null
    }
  },

  async registration({ email, country, firstName, lastName, li_fat_id }) {
    try {
      const payload = createBasePayload({ email, country, firstName, lastName, li_fat_id })
      payload.eventId = `registration_${email}_${Date.now()}`
      const result = await post(payload)
      logger.info('[ConversionTracking:linkedin] registration tracked')
      return result
    } catch (err) {
      logger.error({ err }, '[ConversionTracking:linkedin] registration failed')
      return null
    }
  },

  async subscribe({ price, email, country, firstName, lastName, li_fat_id }) {
    try {
      const payload = createBasePayload({ email, country, firstName, lastName, li_fat_id })
      const value = parseFloat(parseInt(price) / 100).toFixed(2)
      payload.conversionValue = { currencyCode: LINKEDIN_CURRENCY, amount: value === '0.00' ? '1.00' : value }
      payload.eventId = `subscribe_${email}_${Date.now()}`
      const result = await post(payload)
      logger.info('[ConversionTracking:linkedin] subscribe tracked')
      return result
    } catch (err) {
      logger.error({ err }, '[ConversionTracking:linkedin] subscribe failed')
      return null
    }
  },

  health() {
    return {
      provider: 'linkedin',
      configured: this.isConfigured(),
      envVars: ['LINKEDIN_API_SECRET', 'LINKEDIN_CONVERSION_ID', 'LINKEDIN_AD_ACCOUNT_ID'],
    }
  },
}

module.exports = LinkedInAdapter
