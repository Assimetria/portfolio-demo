// @system — Unified Payment Adapter
// Abstracts Stripe and Polar.sh behind a single interface.
// Switch providers by setting PAYMENT_PROVIDER=stripe|polar (default: stripe).
//
// Usage:
//   const payment = require('../PaymentAdapter')
//   const { url } = await payment.createCheckoutSession({ priceId, userId, userEmail })
//   await payment.cancelSubscription(subscriptionId)

'use strict'

const StripeAdapter = require('./StripeAdapter')
const PolarAdapter  = require('./PolarAdapter')

/**
 * @typedef {Object} CheckoutOptions
 * @property {string}  priceId      Provider-specific price/product-price ID
 * @property {number}  userId       Internal user ID (stored in metadata)
 * @property {string}  userEmail    Customer email (pre-fills checkout form)
 * @property {number}  [trialDays]  Trial days (Stripe only — Polar uses product config)
 * @property {string}  [successUrl] Override the default success redirect URL
 * @property {string}  [cancelUrl]  Override the default cancel redirect URL
 *
 * @typedef {Object} CheckoutResult
 * @property {string} url           Hosted checkout URL to redirect the user to
 * @property {string} sessionId     Provider-specific session ID
 *
 * @typedef {Object} NormalizedSubscription
 * @property {string}       provider           'stripe' | 'polar'
 * @property {string}       subscriptionId     Provider subscription ID
 * @property {string|null}  priceId            Provider price ID
 * @property {string|null}  productId          Provider product ID
 * @property {string}       status             'active' | 'trialing' | 'past_due' | 'canceled' | 'inactive'
 * @property {Date|null}    currentPeriodStart
 * @property {Date|null}    currentPeriodEnd
 * @property {boolean}      cancelAtPeriodEnd
 *
 * @typedef {Object} NormalizedPlan
 * @property {string}       priceId
 * @property {string}       productId
 * @property {string}       name
 * @property {string|null}  description
 * @property {number}       amount             In smallest currency unit (cents for USD)
 * @property {string}       currency
 * @property {string}       interval           'month' | 'year' | 'one_time'
 * @property {number}       intervalCount
 * @property {number|null}  trialDays
 * @property {Object}       metadata
 * @property {string}       provider           'stripe' | 'polar'
 */

/** @returns {'stripe'|'polar'} */
function resolveProvider() {
  const p = (process.env.PAYMENT_PROVIDER ?? 'stripe').toLowerCase()
  if (p !== 'stripe' && p !== 'polar') {
    throw new Error(`[PaymentAdapter] Unknown PAYMENT_PROVIDER="${p}". Use "stripe" or "polar".`)
  }
  return p
}

/**
 * Returns the active payment adapter (StripeAdapter or PolarAdapter).
 * @returns {StripeAdapter|PolarAdapter}
 */
function getAdapter() {
  return resolveProvider() === 'polar' ? PolarAdapter : StripeAdapter
}

const PaymentAdapter = {
  /** Which provider is currently active */
  get provider() { return resolveProvider() },

  /**
   * Create a hosted checkout session.
   * @param {CheckoutOptions} opts
   * @returns {Promise<CheckoutResult>}
   */
  createCheckoutSession(opts) {
    return getAdapter().createCheckoutSession(opts)
  },

  /**
   * Create a customer/billing portal session (Stripe only — Polar has no portal).
   * For Polar, throws an explanatory error so callers can gracefully degrade.
   * @param {{ customerId: string, returnUrl?: string }} opts
   * @returns {Promise<{ url: string }>}
   */
  createPortalSession(opts) {
    return getAdapter().createPortalSession(opts)
  },

  /**
   * Cancel a subscription (sets cancel_at_period_end = true where supported).
   * @param {string} subscriptionId  Provider subscription ID
   * @returns {Promise<NormalizedSubscription>}
   */
  cancelSubscription(subscriptionId) {
    return getAdapter().cancelSubscription(subscriptionId)
  },

  /**
   * Reverse a scheduled cancellation (Stripe only).
   * For Polar this is a no-op that throws an explanatory error.
   * @param {string} subscriptionId
   * @returns {Promise<NormalizedSubscription>}
   */
  uncancelSubscription(subscriptionId) {
    return getAdapter().uncancelSubscription(subscriptionId)
  },

  /**
   * List available plans/prices for the pricing page.
   * @returns {Promise<NormalizedPlan[]>}
   */
  listPlans() {
    return getAdapter().listPlans()
  },

  /**
   * Validate and parse an inbound webhook payload.
   * Returns the parsed event object in a provider-agnostic envelope:
   *   { provider, type, data }
   * where `type` is the raw provider event type and `data` is the raw provider object.
   * @param {Buffer}  rawBody
   * @param {Object}  headers   Full request headers object
   * @returns {Promise<{ provider: string, type: string, data: Object }>}
   */
  validateWebhook(rawBody, headers) {
    return getAdapter().validateWebhook(rawBody, headers)
  },
}

module.exports = PaymentAdapter
