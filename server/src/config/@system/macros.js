// @system — Billing & payment config macros
// All sensitive keys come from env vars. Never hardcode.
'use strict'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
const CREDITS_MULTIPLIER = Number(process.env.CREDITS_MULTIPLIER) || 1

module.exports = {
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  CREDITS_MULTIPLIER,
}
