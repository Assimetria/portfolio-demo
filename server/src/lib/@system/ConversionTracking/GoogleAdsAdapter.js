// @system — Google Ads Conversion Tracking adapter
// Mirrors Asymetric Ventures' Google Pixel integration.
// Required env vars:
//   GOOGLE_ADS_API_KEY       — Developer token
//   GOOGLE_ADS_CONVERSION_ID — Client/customer ID
'use strict'

const { createHash } = require('crypto')
const logger = require('../Logger')

function hashData(data) {
  return createHash('sha256').update(data.trim().toLowerCase()).digest('hex')
}

let client = null

function getClient() {
  if (client) return client
  try {
    const { GoogleAdsApi } = require('google-ads-api')
    client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CONVERSION_ID,
      developer_token: process.env.GOOGLE_ADS_API_KEY,
    })
    return client
  } catch (err) {
    logger.warn({ err }, '[ConversionTracking:google] google-ads-api not installed or init failed')
    return null
  }
}

const GoogleAdsAdapter = {
  provider: 'google',

  isConfigured() {
    return !!(process.env.GOOGLE_ADS_API_KEY && process.env.GOOGLE_ADS_CONVERSION_ID)
  },

  async purchase({ price, gclid, email, country, ip, transactionId, searchQuery }) {
    const api = getClient()
    if (!api) return null

    try {
      const response = await api.conversions.upload({
        conversions: [{
          gclid,
          conversion_action: 'Purchase',
          conversion_date_time: new Date().toISOString(),
          user_identifiers: [{
            hashed_email: hashData(email),
            address_info: { country_code: country },
            client_ip_address: ip,
          }],
          conversion_value: parseFloat(parseInt(price) / 100).toFixed(2),
          currency_code: 'USD',
          order_id: transactionId,
          custom_variables: searchQuery ? [{ search_term: searchQuery }] : undefined,
        }],
      })
      logger.info({ transactionId }, '[ConversionTracking:google] purchase tracked')
      return response
    } catch (err) {
      logger.error({ err }, '[ConversionTracking:google] purchase failed')
      return null
    }
  },

  async registration({ email, country, ip }) {
    const api = getClient()
    if (!api) return null

    try {
      const response = await api.conversions.upload({
        conversions: [{
          conversion_action: 'Registration',
          conversion_date_time: new Date().toISOString(),
          user_identifiers: [{
            hashed_email: hashData(email),
            address_info: { country_code: country },
            client_ip_address: ip,
          }],
        }],
      })
      logger.info('[ConversionTracking:google] registration tracked')
      return response
    } catch (err) {
      logger.error({ err }, '[ConversionTracking:google] registration failed')
      return null
    }
  },

  async subscribe(params) {
    // Google Ads uses purchase for subscription events
    return this.purchase(params)
  },

  health() {
    return {
      provider: 'google',
      configured: this.isConfigured(),
      envVars: ['GOOGLE_ADS_API_KEY', 'GOOGLE_ADS_CONVERSION_ID'],
    }
  },
}

module.exports = GoogleAdsAdapter
