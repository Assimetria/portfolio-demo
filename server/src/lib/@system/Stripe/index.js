// @system — Stripe SDK — lazy-initialised so the server starts without STRIPE_SECRET_KEY
// The real Stripe instance is created on first use; any call made without a key throws a
// clear developer error rather than Stripe's opaque authentication response.
const Stripe = require('stripe')

let _instance = null

const stripe = new Proxy(
  {},
  {
    get(_, prop) {
      if (!_instance) {
        const key = process.env.STRIPE_SECRET_KEY
        if (!key) {
          throw new Error(
            '[Stripe] STRIPE_SECRET_KEY is not set. ' +
              'Add it to your .env file to enable Stripe features.',
          )
        }
        _instance = Stripe(key)
      }
      const value = _instance[prop]
      return typeof value === 'function' ? value.bind(_instance) : value
    },
  },
)

module.exports = stripe
