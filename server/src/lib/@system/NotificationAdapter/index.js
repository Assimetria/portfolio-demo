// @system — Unified Notification Adapter
// Abstracts Slack, Discord, and console behind a single interface.
// Switch providers by setting NOTIFICATION_PROVIDER=slack|discord|console
// (default: auto-detects based on configured env vars; falls back to console).
//
// Usage:
//   const Notifications = require('../NotificationAdapter')
//   await Notifications.send({ title: 'Payment failed', body: '...', level: 'error' })

'use strict'

const SlackAdapter   = require('./SlackAdapter')
const DiscordAdapter = require('./DiscordAdapter')
const ConsoleAdapter = require('./ConsoleAdapter')

const ADAPTERS = { slack: SlackAdapter, discord: DiscordAdapter, console: ConsoleAdapter }

/**
 * @typedef {Object} NotifyOptions
 * @property {string}  title       Notification title / headline
 * @property {string}  body        Main message body
 * @property {'info'|'warning'|'error'} [level]  Severity (default: 'info')
 * @property {Object}  [metadata]  Extra key-value pairs shown as fields/context
 *
 * @typedef {Object} NotifyResult
 * @property {string}  provider    Which adapter handled delivery
 * @property {boolean} ok          Whether delivery succeeded
 * @property {boolean} [devMode]   True when using console fallback
 */

/** @returns {'slack'|'discord'|'console'} */
function resolveProvider() {
  const explicit = (process.env.NOTIFICATION_PROVIDER ?? '').toLowerCase()
  if (explicit && ADAPTERS[explicit]) return explicit

  // Auto-detect: pick first configured provider
  if (process.env.SLACK_WEBHOOK_URL)   return 'slack'
  if (process.env.DISCORD_WEBHOOK_URL) return 'discord'
  return 'console'
}

function getAdapter() {
  return ADAPTERS[resolveProvider()]
}

const NotificationAdapter = {
  /** Which provider is currently active */
  get provider() { return resolveProvider() },

  /**
   * Send a notification via the active provider.
   * @param {NotifyOptions} opts
   * @returns {Promise<NotifyResult>}
   */
  send(opts) {
    return getAdapter().send(opts)
  },

  /**
   * Convenience: send an error notification.
   * @param {string} title
   * @param {string} body
   * @param {Object} [metadata]
   */
  error(title, body, metadata) {
    return this.send({ title, body, level: 'error', metadata })
  },

  /**
   * Convenience: send a warning notification.
   * @param {string} title
   * @param {string} body
   * @param {Object} [metadata]
   */
  warn(title, body, metadata) {
    return this.send({ title, body, level: 'warning', metadata })
  },

  /**
   * Convenience: send an info notification.
   * @param {string} title
   * @param {string} body
   * @param {Object} [metadata]
   */
  info(title, body, metadata) {
    return this.send({ title, body, level: 'info', metadata })
  },

  /**
   * Return health/config info for the active adapter.
   */
  health() {
    return getAdapter().health()
  },

  /**
   * Return health info for ALL adapters.
   */
  healthAll() {
    return Object.fromEntries(
      Object.entries(ADAPTERS).map(([name, adapter]) => [name, adapter.health()])
    )
  },
}

module.exports = NotificationAdapter
