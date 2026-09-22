// @system — client-side Stripe helper
// Reads the publishable key from VITE_STRIPE_PUBLISHABLE_KEY and exposes
// a typed helper for creating checkout sessions via the backend API.
//
// Usage:
//   import { createCheckoutSession } from '@/app/lib/@system/stripe'
//   const { url } = await createCheckoutSession(priceId)
//   window.location.href = url

import { api } from './api.js'

/** The publishable key exposed to the browser (pk_test_... or pk_live_...). */
export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

/** Returns true when the publishable key is configured. */
export function isStripeEnabled(){
  return typeof STRIPE_PUBLISHABLE_KEY === 'string' && STRIPE_PUBLISHABLE_KEY.startsWith('pk_')
}

/**
 * Create a Stripe Checkout session via the backend and return the hosted
 * payment page URL. Redirect the user to the returned URL to complete payment.
 *
 * @param priceId  Stripe Price ID (price_...)
 */
export async function createCheckoutSession(priceId) {
  return api.post('/stripe/create-checkout-session', { priceId })
}
