// @system — Console fallback for conversion tracking (dev mode)
'use strict'

const logger = require('../Logger')

const ConsoleAdapter = {
  provider: 'console',
  isConfigured() { return true },

  purchase(params) {
    logger.debug({ event: 'purchase', ...params }, '[ConversionTracking:console] (dev)')
    return { provider: 'console', ok: true, devMode: true }
  },
  registration(params) {
    logger.debug({ event: 'registration', ...params }, '[ConversionTracking:console] (dev)')
    return { provider: 'console', ok: true, devMode: true }
  },
  subscribe(params) {
    logger.debug({ event: 'subscribe', ...params }, '[ConversionTracking:console] (dev)')
    return { provider: 'console', ok: true, devMode: true }
  },
  health() {
    return { provider: 'console', configured: true, devMode: true }
  },
}

module.exports = ConsoleAdapter
