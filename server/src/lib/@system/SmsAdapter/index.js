// @system — Unified SMS Adapter
// Abstracts Twilio, Vonage, and console behind a single interface.
// Switch providers by setting SMS_PROVIDER=twilio|vonage|console
// (default: auto-detects based on configured env vars; falls back to console).
//
// Usage:
//   const Sms = require('../SmsAdapter')
//   await Sms.send({ to: '+15551234567', body: 'Your code is 123456' })

'use strict'

const TwilioAdapter  = require('./TwilioAdapter')
const VonageAdapter  = require('./VonageAdapter')
const ConsoleAdapter = require('./ConsoleAdapter')

const ADAPTERS = { twilio: TwilioAdapter, vonage: VonageAdapter, console: ConsoleAdapter }

/**
 * @typedef {Object} SmsOptions
 * @property {string}  to     Recipient phone number (E.164 format, e.g. +15551234567)
 * @property {string}  body   SMS message body (max 160 chars for single SMS)
 * @property {string}  [from] Override sender (must be configured for provider)
 *
 * @typedef {Object} SmsResult
 * @property {string}  provider   Which adapter handled delivery
 * @property {string}  messageId  Provider-assigned message ID
 * @property {string}  status     Delivery status
 * @property {boolean} [devMode]  True when using console fallback
 */

/** @returns {'twilio'|'vonage'|'console'} */
function resolveProvider() {
  const explicit = (process.env.SMS_PROVIDER ?? '').toLowerCase()
  if (explicit && ADAPTERS[explicit]) return explicit

  // Auto-detect
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) return 'twilio'
  if (process.env.VONAGE_API_KEY && process.env.VONAGE_API_SECRET)      return 'vonage'
  return 'console'
}

function getAdapter() {
  return ADAPTERS[resolveProvider()]
}

const SmsAdapter = {
  /** Which provider is currently active */
  get provider() { return resolveProvider() },

  /**
   * Send an SMS via the active provider.
   * @param {SmsOptions} opts
   * @returns {Promise<SmsResult>}
   */
  send(opts) {
    return getAdapter().send(opts)
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

module.exports = SmsAdapter
