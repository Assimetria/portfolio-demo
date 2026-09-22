// @system — Stripe webhook event handlers
// Ported from Simtria's full webhook pipeline with:
//   - checkout.session.completed (subscription + one-time)
//   - customer.subscription.deleted (cancellation reason mapping)
//   - customer.subscription.updated (credit-worthy change detection, payment failure handling)
//   - invoice.payment_succeeded (credit award on renewal)
//   - invoice.payment_failed (mark past_due)
//   - customer.subscription.created
// Uses raw SQL repos (pg-promise), NOT Sequelize.
'use strict'

const stripe = require('../../../lib/@system/Stripe')
const StripeService = require('../../../lib/@system/Stripe/StripeService')
const logger = require('../../../lib/@system/Logger')
const SubscriptionRepo = require('../../../db/repos/@system/SubscriptionRepo')
const UserRepo = require('../../../db/repos/@system/UserRepo')
const CreditsRepo = require('../../../db/repos/@system/CreditsRepo')
const TransactionRepo = require('../../../db/repos/@system/TransactionRepo')

const CREDITS_MULTIPLIER = Number(process.env.CREDITS_MULTIPLIER) || 1

// ── Metadata merge helper ──────────────────────────────────────────────────

function safelyMergeMetadata(existing = {}, newMeta = {}, additional = {}) {
  const base = (existing && typeof existing === 'object' && !Array.isArray(existing)) ? existing : {}
  const merged = { ...base }
  if (newMeta && typeof newMeta === 'object' && !Array.isArray(newMeta)) {
    for (const [k, v] of Object.entries(newMeta)) {
      if (v !== null && v !== undefined) merged[k] = v
    }
  }
  if (additional && typeof additional === 'object' && !Array.isArray(additional)) {
    for (const [k, v] of Object.entries(additional)) {
      if (v !== null && v !== undefined) merged[k] = v
    }
  }
  return merged
}

// ── Stripe status → DB status mapping ──────────────────────────────────────

function mapStripeStatusToDb(stripeStatus, isActive) {
  if (!stripeStatus) return isActive ? 'active' : 'inactive'
  const map = {
    active: 'active', trialing: 'active', canceled: 'canceled',
    incomplete: 'expired', incomplete_expired: 'expired',
    past_due: 'active', unpaid: 'canceled',
  }
  return map[stripeStatus] || 'inactive'
}

// ── Main webhook handler ───────────────────────────────────────────────────

/**
 * Process a verified Stripe webhook event.
 * This is the "simple" handler that maps events directly to DB operations.
 * For advanced Simtria-style digest processing, use handleDigestedWebhook.
 */
async function handleWebhookEvent(event) {
  const { type, data } = event
  const obj = data.object

  switch (type) {
    // ── Checkout completed ─────────────────────────────────────────────────
    case 'checkout.session.completed': {
      if (obj.mode !== 'subscription' && obj.mode !== 'payment') break

      const userId = obj.client_reference_id ?? obj.metadata?.user_id
      if (!userId) {
        logger.warn({ sessionId: obj.id }, 'checkout.session.completed: no user_id')
        break
      }

      // Persist Stripe customer ID on user
      await UserRepo.updateStripeCustomerId(Number(userId), obj.customer)

      if (obj.mode === 'subscription') {
        const stripeSub = await stripe.subscriptions.retrieve(obj.subscription)
        const item = stripeSub.items.data[0]

        await SubscriptionRepo.upsertByStripeSubscriptionId({
          user_id: Number(userId),
          stripe_subscription_id: stripeSub.id,
          stripe_customer_id: obj.customer,
          stripe_price_id: item.price.id,
          status: stripeSub.status,
          plan: item.price.metadata?.plan || item.price.nickname || 'pro',
          price: item.price.unit_amount || 0,
          periodicity: stripeSub.items.data[0].price.recurring?.interval || null,
          current_period_start: new Date(stripeSub.current_period_start * 1000),
          current_period_end: new Date(stripeSub.current_period_end * 1000),
          cancel_at_period_end: stripeSub.cancel_at_period_end,
          metadata: safelyMergeMetadata({}, obj.metadata),
        })

        logger.info({ userId, subscriptionId: stripeSub.id }, 'checkout completed — subscription created')
      } else {
        // One-time payment — create a transaction record
        await TransactionRepo.create({
          user_id: Number(userId),
          type: 'one-time',
          price: obj.amount_total || 0,
          status: 'paid',
          description: 'One-time purchase',
          external_id: obj.id,
          metadata: obj.metadata || {},
        })
        logger.info({ userId, sessionId: obj.id }, 'checkout completed — one-time purchase')
      }
      break
    }

    // ── Subscription created ───────────────────────────────────────────────
    case 'customer.subscription.created': {
      const user = await UserRepo.findByStripeCustomerId(obj.customer)
      const userId = obj.metadata?.user_id ? Number(obj.metadata.user_id) : user?.id
      if (!userId) {
        logger.warn({ customerId: obj.customer }, 'subscription.created: could not resolve user')
        break
      }
      const item = obj.items.data[0]
      await SubscriptionRepo.upsertByStripeSubscriptionId({
        user_id: userId,
        stripe_subscription_id: obj.id,
        stripe_customer_id: obj.customer,
        stripe_price_id: item?.price?.id,
        status: obj.status,
        plan: item?.price?.metadata?.plan || item?.price?.nickname || null,
        price: item?.price?.unit_amount || 0,
        periodicity: item?.price?.recurring?.interval || null,
        current_period_start: new Date(obj.current_period_start * 1000),
        current_period_end: new Date(obj.current_period_end * 1000),
        cancel_at_period_end: obj.cancel_at_period_end,
        metadata: safelyMergeMetadata({}, obj.metadata),
      })
      logger.info({ userId, subscriptionId: obj.id, status: obj.status }, 'subscription created')
      break
    }

    // ── Subscription updated ───────────────────────────────────────────────
    case 'customer.subscription.updated': {
      const existing = await SubscriptionRepo.findByStripeSubscriptionId(obj.id)
      if (!existing) {
        logger.warn({ subscriptionId: obj.id }, 'subscription.updated: not found locally')
        break
      }

      const item = obj.items?.data?.[0]
      const updateData = {
        stripe_customer_id: obj.customer,
        stripe_price_id: item?.price?.id,
        status: obj.status,
        plan: item?.price?.metadata?.plan || item?.price?.nickname || existing.plan,
        price: item?.price?.unit_amount ?? existing.price,
        periodicity: item?.price?.recurring?.interval || existing.periodicity,
        current_period_start: new Date(obj.current_period_start * 1000),
        current_period_end: new Date(obj.current_period_end * 1000),
        cancel_at_period_end: obj.cancel_at_period_end,
      }

      // Handle cancellation metadata
      if (obj.cancel_at_period_end || obj.status === 'canceled') {
        const { type, reason } = StripeService._mapCancellationReason
          ? StripeService._mapCancellationReason(obj)
          : _mapCancellationReasonLocal(obj)
        updateData.metadata = safelyMergeMetadata(existing.metadata, obj.metadata, {
          cancellation_type: type,
          cancellation_reason: reason,
          stripe_cancellation_reason: obj.cancellation_details?.reason || null,
          stripe_cancellation_feedback: obj.cancellation_details?.feedback || null,
          stripe_canceled_at: obj.canceled_at ? new Date(obj.canceled_at * 1000).toISOString() : null,
          webhook_updated_at: new Date().toISOString(),
        })
        if (obj.status === 'canceled') updateData.status = 'cancelled'
      } else if (obj.status === 'past_due' || obj.status === 'unpaid') {
        // Keep active but log payment issue
        updateData.status = existing.status // preserve — user keeps access
        updateData.metadata = safelyMergeMetadata(existing.metadata, {
          payment_issue: obj.status,
          payment_issue_at: new Date().toISOString(),
        })
      } else {
        updateData.metadata = safelyMergeMetadata(existing.metadata, obj.metadata)
      }

      await SubscriptionRepo.update(existing.id, updateData)
      logger.info({ subscriptionId: obj.id, status: obj.status }, 'subscription updated')
      break
    }

    // ── Subscription deleted ───────────────────────────────────────────────
    case 'customer.subscription.deleted': {
      const existing = await SubscriptionRepo.findByStripeSubscriptionId(obj.id)
      if (!existing) break

      const { type, reason } = _mapCancellationReasonLocal(obj)
      await SubscriptionRepo.update(existing.id, {
        status: 'cancelled',
        metadata: safelyMergeMetadata(existing.metadata, {}, {
          cancellation_type: type,
          cancellation_reason: reason,
          stripe_cancellation_reason: obj.cancellation_details?.reason || null,
          stripe_cancellation_feedback: obj.cancellation_details?.feedback || null,
          stripe_canceled_at: obj.canceled_at ? new Date(obj.canceled_at * 1000).toISOString() : null,
          webhook_updated_at: new Date().toISOString(),
        }),
      })
      logger.info({ subscriptionId: obj.id }, 'subscription cancelled')
      break
    }

    // ── Payment failed ─────────────────────────────────────────────────────
    case 'invoice.payment_failed': {
      const subId = obj.subscription
      if (!subId) break
      const existing = await SubscriptionRepo.findByStripeSubscriptionId(subId)
      if (!existing) break

      await SubscriptionRepo.update(existing.id, {
        // Don't change status — keep active for grace period
        metadata: safelyMergeMetadata(existing.metadata, {
          payment_issue: 'payment_failed',
          payment_failed_at: new Date().toISOString(),
          failed_invoice_id: obj.id,
        }),
      })
      logger.warn({ subscriptionId: subId, invoiceId: obj.id }, 'payment failed')
      break
    }

    // ── Payment succeeded — refresh + award credits ────────────────────────
    case 'invoice.payment_succeeded': {
      const subId = obj.subscription || obj.parent?.subscription_details?.subscription
      if (!subId) break

      const existing = await SubscriptionRepo.findByStripeSubscriptionId(subId)
      if (!existing) break

      // Refresh subscription data from Stripe
      const freshSub = await stripe.subscriptions.retrieve(subId)
      const item = freshSub.items?.data?.[0]
      const quantity = item?.quantity || 1

      await SubscriptionRepo.update(existing.id, {
        stripe_customer_id: freshSub.customer,
        status: freshSub.status,
        current_period_start: new Date(freshSub.current_period_start * 1000),
        current_period_end: new Date(freshSub.current_period_end * 1000),
        cancel_at_period_end: freshSub.cancel_at_period_end,
        last_renew: new Date(),
        metadata: safelyMergeMetadata(existing.metadata, {
          last_paid_invoice: obj.id,
          last_payment_at: new Date().toISOString(),
        }),
      })

      // Award credits on successful payment
      const creditAmount = parseInt((item?.price?.unit_amount || 0) * CREDITS_MULTIPLIER / 100) * quantity
      if (creditAmount > 0) {
        await CreditsRepo.addCredits(existing.user_id, creditAmount, {
          source: 'subscription_renewal',
          invoice_id: obj.id,
          awarded_at: new Date().toISOString(),
        })
        logger.info({ userId: existing.user_id, credits: creditAmount }, 'credits awarded on payment')
      }

      // Create transaction record (avoid duplicates within 10 minutes)
      const recentTx = await TransactionRepo.findByExternalId(existing.stripe_subscription_id)
      const isRecent = recentTx && (Date.now() - new Date(recentTx.created_at).getTime()) < 10 * 60 * 1000
      if (!isRecent) {
        await TransactionRepo.create({
          user_id: existing.user_id,
          type: 'subscription',
          credits: creditAmount,
          price: (item?.price?.unit_amount || 0) * quantity,
          status: 'paid',
          description: 'Subscription payment',
          external_id: existing.stripe_subscription_id,
          metadata: { invoice_id: obj.id },
        })
      }

      logger.info({ subscriptionId: subId, status: freshSub.status }, 'invoice paid — subscription refreshed')
      break
    }

    default:
      logger.debug({ eventType: type }, 'unhandled stripe event type')
  }
}

// ── Local cancellation reason mapper ───────────────────────────────────────

function _mapCancellationReasonLocal(obj) {
  const reason = obj.cancellation_details?.reason
  if (reason === 'cancellation_requested') return { type: 'manual_cancellation', reason: 'user_requested_cancellation' }
  if (reason === 'payment_failed') return { type: 'payment_failed', reason: 'payment_failed' }
  if (reason === 'payment_disputed') return { type: 'payment_failed', reason: 'payment_disputed' }
  if (obj.status === 'past_due') return { type: 'payment_failed', reason: 'payment_overdue' }
  if (obj.status === 'unpaid') return { type: 'payment_failed', reason: 'payment_unpaid' }
  if (obj.status === 'incomplete') return { type: 'checkout_incomplete', reason: 'incomplete_payment' }
  if (obj.status === 'incomplete_expired') return { type: 'checkout_incomplete', reason: 'incomplete_expired' }
  if (obj.canceled_at && obj.cancel_at_period_end) return { type: 'manual_cancellation', reason: 'user_scheduled_cancellation' }
  if (obj.canceled_at) return { type: 'manual_cancellation', reason: 'canceled_no_specific_reason' }
  if (obj.status === 'canceled') return { type: 'manual_cancellation', reason: 'canceled_generic' }
  return { type: 'unknown', reason: reason || `status_${obj.status}` }
}

module.exports = { handleWebhookEvent, safelyMergeMetadata, mapStripeStatusToDb }
