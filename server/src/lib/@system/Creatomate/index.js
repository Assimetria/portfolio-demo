// @system — Creatomate video/creative rendering integration
// Mirrors Asymetric Ventures' Creatomate integration.
// Required env vars:
//   CREATOMATE_API_KEY — API key from creatomate.com
//
// Usage:
//   const Creatomate = require('../Creatomate')
//   const result = await Creatomate.renderTemplate({ templateId: '...', modifications: {} })

'use strict'

const logger = require('../Logger')

let creatomateClient = null

function getClient() {
  if (creatomateClient) return creatomateClient
  if (!process.env.CREATOMATE_API_KEY) return null

  try {
    const { Client } = require('creatomate')
    creatomateClient = new Client(process.env.CREATOMATE_API_KEY)
    return creatomateClient
  } catch (err) {
    logger.warn({ err }, '[Creatomate] creatomate package not installed')
    return null
  }
}

const CreatomateIntegration = {
  isConfigured() {
    return !!process.env.CREATOMATE_API_KEY
  },

  async renderTemplate({ templateId, modifications }) {
    const client = getClient()
    if (!client) throw new Error('Creatomate not configured')

    try {
      const response = await client.render({ templateId, modifications })
      logger.info({ templateId }, '[Creatomate] template rendered')
      return response[0]
    } catch (err) {
      logger.error({ err, templateId }, '[Creatomate] renderTemplate failed')
      throw err
    }
  },

  health() {
    return {
      provider: 'creatomate',
      configured: this.isConfigured(),
      envVars: ['CREATOMATE_API_KEY'],
    }
  },
}

module.exports = CreatomateIntegration
