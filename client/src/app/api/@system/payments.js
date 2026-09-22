// @system — Unified payment API (client-side)
// Uses /api/payments/* which auto-routes to the active provider (Stripe or Polar).
// Drop-in replacement for importing directly from stripe.ts or polar.ts.
//
// Usage:
//   import { getPlans, createCheckout, getSubscription } from '@/app/api/@system/payments'

import { api } from '../../lib/@system/api.js'
import { formatAmount, formatInterval } from './stripe.js'

// ── Types ─────────────────────────────────────────────────────────────────────



// ── Provider ──────────────────────────────────────────────────────────────────

/** Returns the payment provider name configured on the server. */
export async function getProvider(){
  const { provider } = await api.get('/payments/provider')
  return provider
}

// ── Plans ─────────────────────────────────────────────────────────────────────

/** Fetch available pricing plans from the active payment provider. */
export async function getPlans() {
  return api.get('/payments/plans')
}

// ── Checkout ──────────────────────────────────────────────────────────────────

/**
 * Create a checkout session and redirect the user to the hosted payment page.
 * @param priceId    Provider price ID (Stripe priceId or Polar productPriceId)
 * @param trialDays  Optional trial days (Stripe only)
 */
export async function createCheckout(priceId, trialDays){
  const body = { priceId }
  if (trialDays) body.trialDays = trialDays

  const { url } = await api.post('/payments/checkout', body)
  if (url) window.location.href = url
}

// ── Billing portal ────────────────────────────────────────────────────────────

/**
 * Open the billing portal (Stripe Customer Portal).
 * Throws an error for Polar (no portal supported) — catch and show a message.
 */
export async function openBillingPortal(){
  const { url } = await api.post('/payments/portal', {})
  if (url) window.location.href = url
}

// ── Subscription ──────────────────────────────────────────────────────────────

/** Get the current user's active subscription. */
export async function getSubscription() {
  return api.get('/payments/subscription')
}

/** Get all of the current user's subscriptions (history). */
export async function getAllSubscriptions() {
  return api.get('/payments/subscriptions')
}

/** Cancel the current active subscription (sets cancel_at_period_end = true). */
export async function cancelSubscription() {
  return api.delete('/payments/subscription')
}

/** Reverse a scheduled cancellation (Stripe only). */
export async function resumeSubscription() {
  return api.post('/payments/subscription/resume', {})
}

// ── Formatting helpers ────────────────────────────────────────────────────────

/** Format a plan's price localised currency string (e.g. "$9"). */
export function formatPlanAmount(plan){
  return formatAmount(plan.amount, plan.currency)
}

/** Format a plan's billing interval (e.g. "/month", "/year", "one-time"). */
export function formatPlanInterval(plan){
  return formatInterval(plan.interval, plan.intervalCount)
}

/** Returns true when the subscription is in an "access granted" state. */
export function isSubscriptionActive(sub){
  return !!sub && ['active', 'trialing'].includes(sub.status)
}

/** Returns true when the subscription is scheduled to cancel. */
export function isSubscriptionCancelling(sub){
  return isSubscriptionActive(sub) && (sub?.cancelAtPeriodEnd ?? false)
}

/** Human-readable status label. */
export function subscriptionStatusLabel(sub){
  if (!sub) return 'No subscription'
  if (isSubscriptionCancelling(sub)) return 'Cancelling'
  switch (sub.status) {
    case 'active':    return 'Active'
    case 'trialing':  return 'Trial'
    case 'past_due':  return 'Past Due'
    case 'canceled':
    case 'cancelled': return 'Cancelled'
    default:          return 'Inactive'
  }
}
