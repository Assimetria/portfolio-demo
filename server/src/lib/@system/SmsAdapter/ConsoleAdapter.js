// @system — Console SMS adapter (dev fallback)
'use strict'

const logger = require('../Logger')

const ConsoleAdapter = {
  provider: 'console',

  async send({ to, body }) {
    logger.info({ to, body }, '[SmsAdapter:console] SMS (not sent — configure TWILIO_* or VONAGE_*)')
    return { provider: 'console', messageId: 'console', status: 'logged', devMode: true }
  },

  health() {
    return { provider: 'console', configured: true, devMode: true }
  },
}

module.exports = ConsoleAdapter
