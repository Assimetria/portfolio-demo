// @system — Unified Conversion Tracking Adapter
// Abstracts Google Ads, Facebook Pixel, and LinkedIn behind a single interface.
// All providers fire in parallel on each event — configure whichever ones you need.
//
// Usage:
//   const ConversionTracking = require('../ConversionTracking')
//   await ConversionTracking.purchase({ price: 2999, email, country, ip })
//   await ConversionTracking.registration({ email, country, ip })

'use strict'

const GoogleAdsAdapter      = require('./GoogleAdsAdapter')
const FacebookPixelAdapter  = require('./FacebookPixelAdapter')
const LinkedInAdapter       = require('./LinkedInAdapter')
const ConsoleAdapter        = require('./ConsoleAdapter')
const logger                = require('../Logger')

const ALL_ADAPTERS = [GoogleAdsAdapter, FacebookPixelAdapter, LinkedInAdapter]

function isProduction() {
  return process.env.NODE_ENV === 'production'
}

/** Fire event on every configured adapter. Never throws — logs errors and continues. */
async function fireAll(method, params) {
  if (!isProduction()) {
    ConsoleAdapter[method](params)
    return { providers: ['console'], ok: true, devMode: true }
  }

  const results = await Promise.allSettled(
    ALL_ADAPTERS
      .filter(a => a.isConfigured())
      .map(a => a[method](params))
  )

  const fired = []
  for (const [i, result] of results.entries()) {
    const name = ALL_ADAPTERS.filter(a => a.isConfigured())[i]?.provider ?? 'unknown'
    if (result.status === 'fulfilled') {
      fired.push(name)
    } else {
      logger.error({ err: result.reason, provider: name }, `[ConversionTracking] ${method} failed`)
    }
  }

  return { providers: fired, ok: fired.length > 0 }
}

const ConversionTracking = {
  /** Track a purchase conversion */
  purchase(params)      { return fireAll('purchase', params) },

  /** Track a new registration conversion */
  registration(params)  { return fireAll('registration', params) },

  /** Track a subscription conversion */
  subscribe(params)     { return fireAll('subscribe', params) },

  /** Return health info for all adapters */
  health() {
    return {
      google:   GoogleAdsAdapter.health(),
      facebook: FacebookPixelAdapter.health(),
      linkedin: LinkedInAdapter.health(),
    }
  },

  healthAll() {
    return this.health()
  },

  get provider() {
    const configured = ALL_ADAPTERS.filter(a => a.isConfigured()).map(a => a.provider)
    return configured.length ? configured.join('+') : 'none'
  },
}

module.exports = ConversionTracking
