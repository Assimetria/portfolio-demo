/**
 * API tests for POST /api/polar/webhook (supertest, mounted via the full app).
 *
 * Mirrors the Stripe webhook route test: signature verification, mutex-serialized
 * processing with guaranteed 200 ack semantics, and the subscription status
 * transitions applied by the local handler. Polar/DB/logger dependencies are
 * mocked so the route runs with no network/Db.
 */

// ── Silent logger — any method the app / handlers call is stubbed ─────────
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(() => mockLogger),
}
jest.mock('../../../src/lib/@system/Logger', () => mockLogger)

// ── Polar SDK client — mock the pieces the webhook route + handler touch ──
jest.mock('../../../src/lib/@system/Polar', () => ({
  validateWebhook: jest.fn(),
  createCheckoutSession: jest.fn(),
  cancelSubscription: jest.fn(),
  listProducts: jest.fn(),
  getSubscription: jest.fn(),
  listSubscriptions: jest.fn(),
}))

// ── Repo used by the polar webhook handler ────────────────────────────────
jest.mock('../../../src/db/repos/@system/PolarSubscriptionRepo', () => ({
  findById: jest.fn(),
  findByUserId: jest.fn(),
  findActiveByUserId: jest.fn(),
  findByPolarSubscriptionId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  upsertByPolarSubscriptionId: jest.fn(),
  updateStatus: jest.fn(),
}))

// ── Generic infra used by other routers while the full app loads ──────────
jest.mock('../../../src/lib/@system/PostgreSQL', () => ({
  one: jest.fn(),
  oneOrNone: jest.fn(),
  none: jest.fn(),
  any: jest.fn(),
  many: jest.fn(),
  result: jest.fn(),
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
const crypto = require('crypto')
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})
process.env.JWT_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n')
process.env.JWT_PUBLIC_KEY = publicKey.replace(/\n/g, '\\n')

const request = require('supertest')
// Feature modules: this suite exercises the `billing` module, which the
// informational brand.json switches off. Enable it for this file only —
// Helpers/modules.js reads MODULES_JSON when the app loads.
process.env.MODULES_JSON = JSON.stringify({ billing: true })
afterAll(() => { delete process.env.MODULES_JSON })
const app = require('../../../src/app')

const polar = require('../../../src/lib/@system/Polar')
const PolarSubscriptionRepo = require('../../../src/db/repos/@system/PolarSubscriptionRepo')

const NOW = Math.floor(Date.now() / 1000)

function makeSub(overrides = {}) {
  return {
    id: 'psub_123',
    product_id: 'prod_1',
    price_id: 'price_1',
    status: 'active',
    current_period_start: NOW - 86400,
    current_period_end: NOW + 86400,
    cancel_at_period_end: false,
    metadata: { user_id: '42' },
    ...overrides,
  }
}

function postWebhook(event) {
  return request(app)
    .post('/api/polar/webhook')
    .set('Content-Type', 'application/json')
    .set('x-polar-signature-256', 'sha256=testsig')
    .send(JSON.stringify(event))
}



describe('POST /api/polar/webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    polar.validateWebhook.mockReset()
    polar.validateWebhook.mockImplementation((_body) => ({
      id: 'evt_test',
      type: 'unknown.event',
      data: { object: {} },
    }))
  })

  it('returns 400 when signature verification fails', async () => {
    polar.validateWebhook.mockImplementation(() => {
      throw new Error('Polar webhook signature mismatch')
    })

    const res = await request(app)
      .post('/api/polar/webhook')
      .set('Content-Type', 'application/json')
      .set('x-polar-signature-256', 'sha256=bad')
      .send(JSON.stringify({ type: 'subscription.updated' }))

    expect(res.status).toBe(400)
    expect(res.body.message).toBeTruthy()
    expect(PolarSubscriptionRepo.upsertByPolarSubscriptionId).not.toHaveBeenCalled()
  })

  it('acknowledges an unhandled event type with 200 without mutating the Db', async () => {
    polar.validateWebhook.mockImplementation(() => ({
      id: 'evt_unknown',
      type: 'unknown.event',
      data: { object: { id: 'evt_1' } },
    }))

    const res = await postWebhook({ id: 'evt_unknown', type: 'unknown.event' })
    expect(res.status).toBe(200)
    expect(res.body.received).toBe(true)

    expect(PolarSubscriptionRepo.upsertByPolarSubscriptionId).not.toHaveBeenCalled()
    expect(PolarSubscriptionRepo.update).not.toHaveBeenCalled()
  })

  it('upserts a subscription on subscription.updated carrying user_id metadata', async () => {
    const sub = makeSub({ status: 'active', cancel_at_period_end: true })
    polar.validateWebhook.mockImplementation(() => ({
      id: 'evt_sub_updated',
      type: 'subscription.updated',
      data: sub,
    }))

    const res = await postWebhook({ id: 'evt_sub_updated', type: 'subscription.updated', data: sub })
    expect(res.status).toBe(200)
    expect(res.body.received).toBe(true)

    expect(PolarSubscriptionRepo.upsertByPolarSubscriptionId).toHaveBeenCalledTimes(1)
    const args = PolarSubscriptionRepo.upsertByPolarSubscriptionId.mock.calls[0][0]
    expect(args.user_id).toBe(42)
    expect(args.polar_subscription_id).toBe('psub_123')
    expect(args.status).toBe('active')
    expect(args.cancel_at_period_end).toBe(true)
  })

  it('marks an existing subscription canceled on subscription.canceled', async () => {
    polar.validateWebhook.mockImplementation(() => ({
      id: 'evt_sub_canceled',
      type: 'subscription.canceled',
      data: makeSub({ status: 'canceled' }),
    }))

    PolarSubscriptionRepo.findByPolarSubscriptionId.mockResolvedValue({ id: 9 })

    const res = await postWebhook({
      id: 'evt_sub_canceled',
      type: 'subscription.canceled',
      data: makeSub({ status: 'canceled' }),
    })
    expect(res.status).toBe(200)
    expect(res.body.received).toBe(true)

    expect(PolarSubscriptionRepo.findByPolarSubscriptionId).toHaveBeenCalledWith('psub_123')
    const [subscriptionId, updateData] = PolarSubscriptionRepo.update.mock.calls[0]
    expect(subscriptionId).toBe(9)
    expect(updateData.status).toBe('canceled')
    expect(updateData.cancel_at_period_end).toBe(true)
  })

  it('reactivates an existing subscription on subscription.active', async () => {
    polar.validateWebhook.mockImplementation(() => ({
      id: 'evt_sub_active',
      type: 'subscription.active',
      data: makeSub({ status: 'active' }),
    }))

    PolarSubscriptionRepo.findByPolarSubscriptionId.mockResolvedValue({ id: 11 })

    const res = await postWebhook({
      id: 'evt_sub_active',
      type: 'subscription.active',
      data: makeSub({ status: 'active' }),
    })
    expect(res.status).toBe(200)
    expect(res.body.received).toBe(true)

    const [subscriptionId, updateData] = PolarSubscriptionRepo.update.mock.calls[0]
    expect(subscriptionId).toBe(11)
    expect(updateData.status).toBe('active')
  })

  it('still returns 200 (no retries) when the handler throws', async () => {
    polar.validateWebhook.mockImplementation(() => ({
      id: 'evt_err',
      type: 'subscription.updated',
      data: makeSub({ status: 'active' }),
    }))
    PolarSubscriptionRepo.upsertByPolarSubscriptionId.mockRejectedValue(new Error('db unavailable'))

    const res = await postWebhook({
      id: 'evt_err',
      type: 'subscription.updated',
      data: makeSub({ status: 'active' }),
    })
    expect(res.status).toBe(200)
    expect(res.body.received).toBe(true)
  })

  it('serialises duplicate deliveries for the same subscription without dropping acks', async () => {
    PolarSubscriptionRepo.upsertByPolarSubscriptionId.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10))
      return { id: 5 }
    })
    polar.validateWebhook.mockImplementation(() => ({
      id: Math.random(),
      type: 'subscription.updated',
      data: makeSub({ status: 'active' }),
    }))

    const [a, b] = await Promise.all([
      postWebhook(makeSub()),
      postWebhook(makeSub()),
    ])

    // Polar requires an ack for every delivery — both requests must return 200.
    expect(a.status).toBe(200)
    expect(a.body.received).toBe(true)
    expect(b.status).toBe(200)
    expect(b.body.received).toBe(true)
    expect(PolarSubscriptionRepo.upsertByPolarSubscriptionId).toHaveBeenCalledTimes(2)
  })
})
