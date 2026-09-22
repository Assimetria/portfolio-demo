// @system — Console notification adapter (dev fallback)
'use strict'

const logger = require('../Logger')

const ConsoleAdapter = {
  provider: 'console',

  /**
   * Log a notification to console (dev fallback).
   * @param {{ title: string, body: string, level?: string, metadata?: Object }} opts
   * @returns {Promise<{ provider: string, ok: boolean, devMode: boolean }>}
   */
  async send({ title, body, level = 'info', metadata = {} }) {
    const logFn = level === 'error' ? logger.error.bind(logger) : level === 'warning' ? logger.warn.bind(logger) : logger.info.bind(logger)
    logFn({ title, body, metadata }, `[NotificationAdapter:console] ${title}`)
    return { provider: 'console', ok: true, devMode: true }
  },

  health() {
    return { provider: 'console', configured: true, devMode: true }
  },
}

module.exports = ConsoleAdapter
