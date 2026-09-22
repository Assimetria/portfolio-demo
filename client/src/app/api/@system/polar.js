// @system — Polar.sh API calls (client-side)
// Mirrors stripe.ts so either provider can be used from the billing UI.
import { api } from '../../lib/@system/api.js'

// ── Types ─────────────────────────────────────────────────────────────────────



// ── API calls ─────────────────────────────────────────────────────────────────

/** List available Polar products/prices for the pricing page (public). */
export async function getPolarProducts() {
  const { products } = await api.get('/polar/products')

  const plans = []
  for (const product of products) {
    if (product.is_archived || !product.is_recurring) continue
    for (const price of product.prices ?? []) {
      if (price.is_archived) continue
      plans.push({
        provider:      'polar',
        priceId:       price.id,
        productId:     product.id,
        name:          product.name,
        description:   product.description,
        amount:        price.price_amount,
        currency:      (price.price_currency ?? 'usd').toLowerCase(),
        interval:      price.recurring_interval ?? 'month',
        intervalCount: 1,
        trialDays: null,
        metadata:      product.metadata ?? {} })
    }
  }

  return { products: plans }
}

/** Get the current user's active Polar subscription. */
export async function getPolarSubscription() {
  return api.get('/polar/subscription')
}

/**
 * Redirect to a Polar hosted checkout for a given product price ID.
 * @param productPriceId  Polar product price ID
 */
export async function createPolarCheckoutSession(productPriceId){
  const { url } = await api.post('/polar/create-checkout-session', { productPriceId })
  if (url) window.location.href = url
}

/** Cancel the current user's active Polar subscription. */
export async function cancelPolarSubscription() {
  return api.delete('/polar/subscription')
}

// ── Formatting helpers (mirrors stripe.ts) ────────────────────────────────────

/** Format a price amount (cents) to a human-readable currency string. */
export function formatPolarAmount(amount, currency){
  return new Intl.NumberFormat('en-US', {
    style:                 'currency',
    currency:              currency.toUpperCase(),
    minimumFractionDigits: amount % 100 === 0 ? 0 : 2 }).format(amount / 100)
}

/** Format a billing interval to a human-readable label (e.g. "/month"). */
export function formatPolarInterval(interval){
  if (interval === 'one_time') return 'one-time'
  return `/${interval}`
}
