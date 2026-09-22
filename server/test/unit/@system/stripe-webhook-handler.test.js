// @system — Unit tests for the Stripe webhook event handler's subscription status hooks.
// Mocks the Stripe SDK client, StripeService, Logger and all repos (SubscriptionRepo,
// UserRepo, CreditsRepo, TransactionRepo) so no DB/network is touched.
'use strict'

// Silent logger — every method the handler may call is stubbed.
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(() => mockLogger),
}
jest.mock('../../../src/lib/@system/Logger', () => mockLogger)

jest.mock('../../../src/lib/@system/Stripe', () => ({
  subscriptions: { retrieve: jest.fn() },
  webhooks: {},
}))
// StripeService mock deliberately omits _mapCancellationReason so the updated/deleted
// handlers fall through to the local _mapCancellationReasonLocal mapper under test.
jest.mock('../../../src/lib/@system/Stripe/StripeService', () => ({}))

jest.mock('../../../src/db/repos/@system/SubscriptionRepo', () => ({
  findByStripeSubscriptionId: jest.fn(),
  upsertByStripeSubscriptionId: jest.fn(),
  update: jest.fn(),
}))
jest.mock('../../../src/db/repos/@system/UserRepo', () => ({
  findByStripeCustomerId: jest.fn(),
  updateStripeCustomerId: jest.fn(),
}))
jest.mock('../../../src/db/repos/@system/CreditsRepo', () => ({
  addCredits: jest.fn(),
}))
jest.mock('../../../src/db/repos/@system/TransactionRepo', () => ({
  findByExternalId: jest.fn(),
  create: jest.fn(),
}))

const {
  handleWebhookEvent,
  mapStripeStatusToDb,
} = require('../../../src/api/@system/stripe/webhook-handler')

const stripe = require('../../../src/lib/@system/Stripe')
const SubscriptionRepo = require('../../../src/db/repos/@system/SubscriptionRepo')
const UserRepo = require('../../../src/db/repos/@system/UserRepo')
const CreditsRepo = require('../../../src/db/repos/@system/CreditsRepo')
const TransactionRepo = require('../../../src/db/repos/@system/TransactionRepo')

const NOW = Math.floor(Date.now() / 1000)

function makeSub(overrides = {}) {
  return {
    id: 'sub_test123',
    object: 'subscription',
    customer: 'cus_test123',
    status: 'active',
    cancel_at_period_end: false,
    current_period_start: NOW - 86400,
    current_period_end: NOW + 86400,
    items: { data: [{ id: 'si_test', price: { id: 'price_monthly', unit_amount: 2000, metadata: { plan: 'pro' }, recurring: { interval: 'month' } }, quantity: 1 }] },
    metadata: {},
    ...overrides,
  }
}

describe('stripe webhook-handler — subscription status hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('mapStripeStatusToDb', () => {
    it.each([
      // stripeStatus, isActive, expected DB status
      ['active', false, 'active'],
      ['trialing', false, 'active'],
      ['canceled', true, 'canceled'],
      ['unpaid', true, 'canceled'],
      ['past_due', true, 'active'],
      ['incomplete', true, 'expired'],
      ['incomplete_expired', true, 'expired'],
    ])('maps %s -> %s', (stripeStatus, isActive, expected) => {
      expect(mapStripeStatusToDb(stripeStatus, isActive)).toBe(expected)
    })

    it('falls back to "inactive" for unknown statuses', () => {
      expect(mapStripeStatusToDb('weird_status', false)).toBe('inactive')
    })

    it('uses the isActive flag when no stripe status is present', () => {
      expect(mapStripeStatusToDb(null, true)).toBe('active')
      expect(mapStripeStatusToDb(null, false)).toBe('inactive')
    })
  })

  describe('customer.subscription.updated', () => {
    it('persists status/price/period and merges cancellation metadata via the local mapper', async () => {
      const existing = { ...makeSub(), id: 5, plan: 'pro', metadata: { prior: 'kept' } }
      SubscriptionRepo.findByStripeSubscriptionId.mockResolvedValue(existing)

      const event = {
        type: 'customer.subscription.updated',
        data: {
          object: makeSub({
            status: 'canceled',
            cancel_at_period_end: true,
            canceled_at: NOW,
            cancellation_details: { reason: 'cancellation_requested', feedback: 'too_expensive' },
            metadata: { __meta: true },
          }),
        },
      }

      await handleWebhookEvent(event)

      // Status forced to the local "cancelled" spelling, period + price preserved.
      const args = SubscriptionRepo.update.mock.calls[0]
      expect(args[0]).toBe(5)
      expect(args[1].status).toBe('cancelled')
      expect(args[1].stripe_price_id).toBe('price_monthly')
      expect(args[1].price).toBe(2000)
      expect(args[1].periodicity).toBe('month')
      expect(args[1].current_period_start).toEqual(new Date((NOW - 86400) * 1000))

      const meta = args[1].metadata
      // Prior metadata is preserved and merged under the identified cancellation reason.
      expect(meta.prior).toBe('kept')
      expect(meta.cancellation_type).toBe('manual_cancellation')
      expect(meta.cancellation_reason).toBe('user_requested_cancellation')
      expect(meta.stripe_cancellation_reason).toBe('cancellation_requested')
      expect(meta.stripe_cancellation_feedback).toBe('too_expensive')
      expect(meta.stripe_canceled_at).toBe(new Date(NOW * 1000).toISOString())
    })

    it('flags a payment_issue without changing status for past_due (keeps access)', async () => {
      const existing = { ...makeSub(), id: 9, status: 'active', metadata: {} }
      SubscriptionRepo.findByStripeSubscriptionId.mockResolvedValue(existing)

      const event = {
        type: 'customer.subscription.updated',
        data: { object: makeSub({ status: 'past_due' }) },
      }

      await handleWebhookEvent(event)

      const args = SubscriptionRepo.update.mock.calls[0]
      // Status preserved (active) for the grace period.
      expect(args[1].status).toBe('active')
      expect(args[1].metadata.payment_issue).toBe('past_due')
      expect(args[1].metadata.payment_issue_at).toBeDefined()
    })

    it('does nothing when the subscription is not tracked locally', async () => {
      SubscriptionRepo.findByStripeSubscriptionId.mockResolvedValue(null)
      await handleWebhookEvent({ type: 'customer.subscription.updated', data: { object: makeSub() } })
      expect(SubscriptionRepo.update).not.toHaveBeenCalled()
    })
  })

  describe('customer.subscription.deleted', () => {
    it('marks the local subscription cancelled and maps the cancellation reason', async () => {
      const existing = { ...makeSub(), id: 3, metadata: {} }
      SubscriptionRepo.findByStripeSubscriptionId.mockResolvedValue(existing)

      const event = {
        type: 'customer.subscription.deleted',
        data: { object: makeSub({ status: 'canceled', cancellation_details: { reason: 'payment_failed' } }) },
      }

      await handleWebhookEvent(event)

      expect(SubscriptionRepo.update).toHaveBeenCalledTimes(1)
      const [id, updateData] = SubscriptionRepo.update.mock.calls[0]
      expect(id).toBe(3)
      expect(updateData.status).toBe('cancelled')
      expect(updateData.metadata.cancellation_type).toBe('payment_failed')
      expect(updateData.metadata.cancellation_reason).toBe('payment_failed')
    })

    it('no-ops when there is no local subscription', async () => {
      SubscriptionRepo.findByStripeSubscriptionId.mockResolvedValue(null)
      await handleWebhookEvent({ type: 'customer.subscription.deleted', data: { object: makeSub() } })
      expect(SubscriptionRepo.update).not.toHaveBeenCalled()
    })
  })

  describe('invoice.payment_succeeded', () => {
    it('refreshes status, awards credits, and creates a transaction when none exists recently', async () => {
      const existing = { ...makeSub(), id: 7, user_id: 42, stripe_subscription_id: 'sub_test123', metadata: {} }
      SubscriptionRepo.findByStripeSubscriptionId.mockResolvedValue(existing)
      SubscriptionRepo.update.mockResolvedValue(existing)
      // No recent transaction for this external id → dedupe allows creating one.
      TransactionRepo.findByExternalId.mockResolvedValue(null)
      stripe.subscriptions.retrieve.mockResolvedValue(makeSub({ id: 'sub_test123', status: 'active' }))

      const event = {
        type: 'invoice.payment_succeeded',
        data: { object: { id: 'in_1', subscription: 'sub_test123', payment_intent: 'pi_1' } },
      }

      await handleWebhookEvent(event)

      expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_test123')

      // Status refresh applied.
      expect(SubscriptionRepo.update).toHaveBeenCalled()
      const [, updateData] = SubscriptionRepo.update.mock.calls[0]
      expect(updateData.status).toBe('active')
      expect(updateData.metadata.last_paid_invoice).toBe('in_1')
      expect(updateData.metadata.last_payment_at).toBeDefined()

      // Credits (unit_amount 2000 * multiplier 1 / 100 === 20) awarded once.
      expect(CreditsRepo.addCredits).toHaveBeenCalledWith(
        42,
        20,
        expect.objectContaining({ source: 'subscription_renewal', invoice_id: 'in_1' }),
      )

      // Transaction created.
      expect(TransactionRepo.create).toHaveBeenCalledTimes(1)
      const tx = TransactionRepo.create.mock.calls[0][0]
      expect(tx.user_id).toBe(42)
      expect(tx.type).toBe('subscription')
      expect(tx.external_id).toBe('sub_test123')
    })

    it('dedupes within 10 minutes of a recent transaction for the same external id', async () => {
      const existing = { ...makeSub(), id: 8, user_id: 7, metadata: {} }
      SubscriptionRepo.findByStripeSubscriptionId.mockResolvedValue(existing)
      stripe.subscriptions.retrieve.mockResolvedValue(makeSub())
      // A transaction created moments ago → skip creating a duplicate.
      TransactionRepo.findByExternalId.mockResolvedValue({
        created_at: new Date(Date.now() - 60 * 1000).toISOString(),
      })

      await handleWebhookEvent({
        type: 'invoice.payment_succeeded',
        data: { object: { id: 'in_2', subscription: 'sub_test123' } },
      })

      expect(TransactionRepo.create).not.toHaveBeenCalled()
    })
  })

  describe('invoice.payment_failed', () => {
    it('keeps the subscription active (grace period) but flags payment_issue metadata', async () => {
      const existing = { ...makeSub(), id: 4, status: 'active', metadata: {} }
      SubscriptionRepo.findByStripeSubscriptionId.mockResolvedValue(existing)

      const event = {
        type: 'invoice.payment_failed',
        data: { object: { id: 'in_fail', subscription: 'sub_test123' } },
      }

      await handleWebhookEvent(event)

      expect(SubscriptionRepo.update).toHaveBeenCalledTimes(1)
      const [, updateData] = SubscriptionRepo.update.mock.calls[0]
      // Status NOT changed — user keeps access.
      expect(updateData.status).toBeUndefined()
      expect(updateData.metadata.payment_issue).toBe('payment_failed')
      expect(updateData.metadata.failed_invoice_id).toBe('in_fail')
      expect(updateData.metadata.payment_failed_at).toBeDefined()
    })
  })

  describe('customer.subscription.created', () => {
    it('upserts a subscription record resolved from metadata user_id', async () => {
      const event = {
        type: 'customer.subscription.created',
        data: { object: makeSub({ metadata: { user_id: '42' } }) },
      }

      await handleWebhookEvent(event)

      expect(SubscriptionRepo.upsertByStripeSubscriptionId).toHaveBeenCalledTimes(1)
      const args = SubscriptionRepo.upsertByStripeSubscriptionId.mock.calls[0][0]
      expect(args.user_id).toBe(42)
      expect(args.stripe_subscription_id).toBe('sub_test123')
      expect(args.stripe_customer_id).toBe('cus_test123')
      expect(args.status).toBe('active')
    })

    it('resolves the user via Stripe customer id when metadata is absent', async () => {
      UserRepo.findByStripeCustomerId.mockResolvedValue({ id: 99 })
      const event = {
        type: 'customer.subscription.created',
        data: { object: makeSub({ metadata: {} }) },
      }

      await handleWebhookEvent(event)

      expect(UserRepo.findByStripeCustomerId).toHaveBeenCalledWith('cus_test123')
      const args = SubscriptionRepo.upsertByStripeSubscriptionId.mock.calls[0][0]
      expect(args.user_id).toBe(99)
    })
  })

  describe('checkout.session.completed', () => {
    it('persists the Stripe customer id and upserts a subscription for mode=subscription', async () => {
      const checkout = {
        id: 'cs_1',
        mode: 'subscription',
        object: 'checkout.session',
        customer: 'cus_test123',
        subscription: 'sub_test123',
        client_reference_id: '42',
        metadata: {},
      }

      stripe.subscriptions.retrieve.mockResolvedValue(makeSub({ id: 'sub_test123', status: 'active' }))

      await handleWebhookEvent({ type: 'checkout.session.completed', data: { object: checkout } })

      expect(UserRepo.updateStripeCustomerId).toHaveBeenCalledWith(42, 'cus_test123')
      expect(SubscriptionRepo.upsertByStripeSubscriptionId).toHaveBeenCalledTimes(1)
      const args = SubscriptionRepo.upsertByStripeSubscriptionId.mock.calls[0][0]
      expect(args.user_id).toBe(42)
      expect(args.stripe_customer_id).toBe('cus_test123')
      expect(args.plan).toBe('pro')
    })
  })

  describe('unhandled events', () => {
    it('logs a debug message and no-ops for unknown event types', async () => {
      await handleWebhookEvent({ type: 'charge.updated', data: { object: { id: 'ch_1' } } })

      expect(SubscriptionRepo.update).not.toHaveBeenCalled()
      expect(SubscriptionRepo.upsertByStripeSubscriptionId).not.toHaveBeenCalled()
      expect(CreditsRepo.addCredits).not.toHaveBeenCalled()
      expect(TransactionRepo.create).not.toHaveBeenCalled()

      const logger = require('../../../src/lib/@system/Logger')
      expect(logger.debug).toHaveBeenCalled()
    })
  })
})

