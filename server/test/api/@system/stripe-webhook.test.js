/**
 * API tests for POST /api/stripe/webhook (supertest, mounted via the full app).
 *
 * Exposes the Stripe webhook transport layer end-to-end: signature verification,
 * mutex-serialized processing, and the guaranteed 200 response semantics.
 * DB/Stripe/logger dependencies are mocked so the route runs with no network/Db.
 */

const crypto = require('crypto')

// ── Silent logger — any method the app / handlers call is stubbed ─────────
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(() => mockLogger),
}
jest.mock('../../../src/lib/@system/Logger', () => mockLogger)

// ── Stripe SDK proxy — mock the pieces the webhook route + handler touch ──
jest.mock('../../../src/lib/@system/Stripe', () => ({
  subscriptions: { retrieve: jest.fn() },
  webhooks: { constructEvent: jest.fn() },
  products: { list: jest.fn() },
  prices: { list: jest.fn() },
  checkout: { sessions: jest.fn() },
  billingPortal: { sessions: jest.fn() },
}))

// StripeService deliberately omits _mapCancellationReason so the webhook handler
// falls through to the local cancellation mapper (keeps the test path local).
jest.mock('../../../src/lib/@system/Stripe/StripeService', () => ({}))

// ── Repos used by the webhook handler ─────────────────────────────────────
jest.mock('../../../src/db/repos/@system/SubscriptionRepo', () => ({
  findByStripeSubscriptionId: jest.fn(),
  findActiveByUserId: jest.fn(),
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

// ── Generic infra used by other routers while the full app loads ──────────
jest.mock('../../../src/lib/@system/PostgreSQL', () => ({
  one: jest.fn(),
  oneOrNone: jest.fn(),
  none: jest.fn(),
  any: jest.fn(),
  many: jest.fn(),
  tx: jest.fn(),
}))
jest.mock('../../../src/lib/@system/Redis', () => ({
  client: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
  },
  isReady: () => false,
}))
jest.mock('../../../src/lib/@system/Email', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}))

// JWT keys are read at module-load time — must exist BEFORE requiring the app.
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})
process.env.JWT_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n')
process.env.JWT_PUBLIC_KEY = publicKey.replace(/\n/g, '\\n')
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret'

const request = require('supertest')
// Feature modules: this suite exercises the `billing` module, which the
// informational brand.json switches off. Enable it for this file only —
// Helpers/modules.js reads MODULES_JSON when the app loads.
process.env.MODULES_JSON = JSON.stringify({ billing: true })
afterAll(() => { delete process.env.MODULES_JSON })
const app = require('../../../src/app')

const stripe = require('../../../src/lib/@system/Stripe')
const SubscriptionRepo = require('../../../src/db/repos/@system/SubscriptionRepo')

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

/** @param {object} event stripped event object echoed in the mocked signature. */
async function postWebhook(buildEvent, { signature = 'test_sig' } = {}) {
  const body = JSON.stringify({ type: buildEvent.type, data: buildEvent.data })
  return request(app)
    .post('/api/stripe/webhook')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', signature)
    .send(body)
}

describe('POST /api/stripe/webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    stripe.webhooks.constructEvent.mockReset()
    stripe.webhooks.constructEvent.mockImplementation((_body, sig) => {
      if (!sig) throw new Error('No signatures found matching the expected signature for payload.')
      return { id: 'evt_test', type: 'unknown.test', data: { object: {} } }
    })
    stripe.subscriptions.retrieve.mockReset()
  })

  it('returns 400 when signature verification fails', async () => {
    stripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload.')
    })

    const res = await request(app)
      .post('/api/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'bad_sig')
      .send(JSON.stringify({ type: 'customer.subscription.updated', data: { object: {} } }))

    expect(res.status).toBe(400)
    expect(res.body.message).toBeTruthy()
  })

  it('acknowledges an unhandled webhook event with 200 without mutating the Db', async () => {
    stripe.webhooks.constructEvent.mockImplementation(() => ({
      id: 'evt_unknown',
      type: 'unknown.event',
      data: { object: { id: 'ch_1' } },
    }))

    const res = await postWebhook({ type: 'unknown.event' })
    expect(res.status).toBe(200)
    expect(res.body.received).toBe(true)

    expect(SubscriptionRepo.update).not.toHaveBeenCalled()
    expect(SubscriptionRepo.upsertByStripeSubscriptionId).not.toHaveBeenCalled()
  })

  it('processes a subscription.updated event and persists the status change', async () => {
    const existing = { ...makeSub(), id: 5, plan: 'pro', metadata: { prior: 'kept' } }
    SubscriptionRepo.findByStripeSubscriptionId.mockResolvedValue(existing)

    const event = {
      id: 'evt_sub_updated',
      type: 'customer.subscription.updated',
      data: {
        object: makeSub({
          status: 'canceled',
          cancel_at_period_end: true,
          canceled_at: NOW,
          cancellation_details: { reason: 'cancellation_requested', feedback: 'too_expensive' },
          metadata: {},
        }),
      },
    }
    stripe.webhooks.constructEvent.mockImplementation(() => event)

    const res = await postWebhook({ type: event.type, data: event.data })
    expect(res.status).toBe(200)
    expect(res.body.received).toBe(true)

    // The local mapper ran and the status transition reached the repo.
    expect(SubscriptionRepo.update).toHaveBeenCalledTimes(1)
    const [subscriptionId, updateData] = SubscriptionRepo.update.mock.calls[0]
    expect(subscriptionId).toBe(5)
    expect(updateData.status).toBe('cancelled')
    expect(updateData.metadata.cancellation_type).toBe('manual_cancellation')
    expect(updateData.metadata.cancellation_reason).toBe('user_requested_cancellation')
  })

  it('still returns 200 (no retry) and a warning when the handler throws', async () => {
    SubscriptionRepo.findByStripeSubscriptionId.mockRejectedValue(new Error('db unavailable'))

    const event = {
      id: 'evt_err',
      type: 'customer.subscription.updated',
      data: { object: makeSub({ status: 'past_due' }) },
    }
    stripe.webhooks.constructEvent.mockImplementation(() => event)

    const res = await postWebhook({ type: event.type, data: event.data })
    expect(res.status).toBe(200)
    expect(res.body.received).toBe(true)
    expect(res.body.warning).toContain('db unavailable')
  })

  it('serialises duplicate deliveries for the same customer without dropping acks', async () => {
    const existing = { ...makeSub(), id: 7, plan: 'pro', metadata: {} }
    SubscriptionRepo.findByStripeSubscriptionId.mockResolvedValue(existing)
    SubscriptionRepo.update.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10))
      return existing
    })

    const makeEvent = (n) => ({
      id: `evt_dup_${n}`,
      type: 'customer.subscription.updated',
      data: {
        object: makeSub({ status: 'canceled', cancel_at_period_end: true, canceled_at: NOW }),
      },
    })
    stripe.webhooks.constructEvent.mockImplementation(() => makeEvent(Math.random()))

    const [a, b] = await Promise.all([
      postWebhook(makeEvent(1)),
      postWebhook(makeEvent(2)),
    ])

    // Stripe requires an ack for every delivery — both requests must return 200.
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(SubscriptionRepo.update).toHaveBeenCalledTimes(2)
  })
})

