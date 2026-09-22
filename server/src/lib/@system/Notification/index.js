// @system — Notification service
// Simple wrapper around NotificationAdapter for sending notifications to Slack, Discord, etc.
//
// Environment variables:
//   NOTIFICATION_PROVIDER  — 'slack' | 'discord' | 'console' (optional; auto-detected)
//   SLACK_WEBHOOK_URL      — Slack webhook URL
//   DISCORD_WEBHOOK_URL    — Discord webhook URL
//
// Usage:
//   const Notification = require('./lib/@system/Notification')
//   await Notification.send({ title: 'Payment failed', body: '...', level: 'error' })
//   await Notification.error('Payment failed', 'User ID: 123')
//   await Notification.warn('High CPU usage', '95% for 5 minutes')
//   await Notification.info('Deployment complete', 'Version 1.2.3 deployed')

'use strict'

const NotificationAdapter = require('../NotificationAdapter')
const logger = require('../Logger')

/**
 * Send a notification via the configured provider (Slack, Discord, or console).
 *
 * @param {object} opts
 * @param {string} opts.title       Notification title / headline
 * @param {string} opts.body        Main message body
 * @param {'info'|'warning'|'error'} [opts.level]  Severity (default: 'info')
 * @param {object} [opts.metadata]  Extra key-value pairs shown as fields/context
 * @returns {Promise<{ provider: string, ok: boolean, devMode?: boolean }>}
 */
async function send({ title, body, level = 'info', metadata }) {
  try {
    const result = await NotificationAdapter.send({ title, body, level, metadata })
    logger.info({ provider: result.provider, title }, '[Notification] sent')
    return result
  } catch (err) {
    logger.error({ err, title }, '[Notification] send failed')
    throw err
  }
}

/**
 * Send an error notification.
 * @param {string} title
 * @param {string} body
 * @param {object} [metadata]
 */
async function error(title, body, metadata) {
  return send({ title, body, level: 'error', metadata })
}

/**
 * Send a warning notification.
 * @param {string} title
 * @param {string} body
 * @param {object} [metadata]
 */
async function warn(title, body, metadata) {
  return send({ title, body, level: 'warning', metadata })
}

/**
 * Send an info notification.
 * @param {string} title
 * @param {string} body
 * @param {object} [metadata]
 */
async function info(title, body, metadata) {
  return send({ title, body, level: 'info', metadata })
}

/**
 * Get health status of the notification system.
 */
function health() {
  return NotificationAdapter.health()
}

/**
 * Get the active notification provider.
 */
function getProvider() {
  return NotificationAdapter.provider
}

module.exports = {
  send,
  error,
  warn,
  info,
  health,
  getProvider,
}
