// @system — Stripe checkout + billing portal API calls
import { api } from '../../lib/@system/api.js'



// Fetch available pricing plans from Stripe
export async function getPlans() {
  return api.get('/subscriptions/plans')
}

// Get current user's active subscription
export async function getMySubscription() {
  return api.get('/subscriptions/me')
}

// Redirect to Stripe Checkout for a given priceId
export async function createCheckoutSession(priceId, trialDays){
  const body = { priceId }
  if (trialDays) body.trialDays = trialDays

  const { url } = await api.post('/stripe/create-checkout-session', body)
  if (url) window.location.href = url
}

// Redirect to Stripe Customer Portal for subscription management
export async function createPortalSession(){
  const { url } = await api.post('/stripe/create-portal-session', {})
  if (url) window.location.href = url
}

// Cancel subscription at period end
// Optionally accepts a reason + free-text feedback so the server can record why
// the user is churning (stored in the subscription metadata on the backend).
export async function cancelSubscription({ reason, feedback } = {}) {
  const body = {}
  if (reason) body.reason = reason
  if (feedback) body.feedback = feedback
  return api.post('/stripe/cancel-subscription', body)
}

// Reverse a scheduled cancellation
export async function uncancelSubscription() {
  return api.post('/stripe/uncancel-subscription', {})
}

// Format a Stripe amount (cents) to a human-readable string
export function formatAmount(amount, currency){
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: amount % 100 === 0 ? 0 : 2 }).format(amount / 100)
}

// Format billing interval to human-readable label (e.g. "/month", "/year")
export function formatInterval(interval, intervalCount){
  if (interval === 'one_time') return 'one-time'
  const label = intervalCount === 1 ? interval : `${intervalCount} ${interval}s`
  return `/${label}`
}
