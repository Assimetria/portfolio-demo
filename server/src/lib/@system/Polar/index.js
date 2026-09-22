// @system — Polar.sh API client
// Alternative to Stripe for payments & subscriptions.
// Docs: https://docs.polar.sh/api

const BASE_URL = 'https://api.polar.sh'

function getToken() {
  const token = process.env.POLAR_ACCESS_TOKEN
  if (!token) throw new Error('POLAR_ACCESS_TOKEN env var is not set')
  return token
}

async function polarRequest(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json()

  if (!res.ok) {
    const message = data?.detail?.[0]?.msg ?? data?.detail ?? data?.message ?? 'Polar API error'
    const err = new Error(message)
    err.status = res.status
    err.polarData = data
    throw err
  }

  return data
}

const polar = {
  // ── Checkout ──────────────────────────────────────────────────────────────

  /**
   * Create a hosted checkout session.
   * @param {object} opts
   * @param {string} opts.productPriceId   Polar product price ID
   * @param {string} opts.successUrl       Redirect URL on successful payment
   * @param {string} [opts.customerEmail]  Pre-fill the customer email
   * @param {object} [opts.metadata]       Key/value metadata attached to the checkout
   */
  async createCheckoutSession({ productPriceId, successUrl, customerEmail, metadata = {} }) {
    return polarRequest('POST', '/v1/checkouts/custom/', {
      product_price_id: productPriceId,
      success_url: successUrl,
      customer_email: customerEmail,
      metadata,
    })
  },

  /**
   * Retrieve a checkout session by ID.
   */
  async getCheckoutSession(checkoutId) {
    return polarRequest('GET', `/v1/checkouts/custom/${checkoutId}`)
  },

  // ── Subscriptions ─────────────────────────────────────────────────────────

  /**
   * List subscriptions for a customer email.
   */
  async listSubscriptions({ customerEmail, page = 1, limit = 10 } = {}) {
    const params = new URLSearchParams({ page, limit })
    if (customerEmail) params.set('customer_email', customerEmail)
    return polarRequest('GET', `/v1/subscriptions/?${params}`)
  },

  /**
   * Get a single subscription by ID.
   */
  async getSubscription(subscriptionId) {
    return polarRequest('GET', `/v1/subscriptions/${subscriptionId}`)
  },

  /**
   * Cancel a subscription (cancels at period end).
   */
  async cancelSubscription(subscriptionId) {
    return polarRequest('DELETE', `/v1/subscriptions/${subscriptionId}`)
  },

  // ── Products ──────────────────────────────────────────────────────────────

  /**
   * List all products in the organisation.
   */
  async listProducts({ isArchived = false } = {}) {
    const params = new URLSearchParams({ is_archived: isArchived })
    return polarRequest('GET', `/v1/products/?${params}`)
  },

  /**
   * Get a single product by ID.
   */
  async getProduct(productId) {
    return polarRequest('GET', `/v1/products/${productId}`)
  },

  // ── Webhooks ──────────────────────────────────────────────────────────────

  /**
   * Validate and parse a Polar webhook payload.
   * Polar sends a X-Polar-Signature-256 header using HMAC-SHA256.
   * @param {Buffer} rawBody   Raw request body (Buffer)
   * @param {string} signature  Value of X-Polar-Signature-256 header
   * @returns {object}          Parsed webhook event
   */
  validateWebhook(rawBody, signature) {
    const crypto = require('crypto')
    const secret = process.env.POLAR_WEBHOOK_SECRET
    if (!secret) throw new Error('POLAR_WEBHOOK_SECRET env var is not set')

    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')

    const trusted = Buffer.from(`sha256=${expected}`, 'utf8')
    const received = Buffer.from(signature, 'utf8')

    if (trusted.length !== received.length || !crypto.timingSafeEqual(trusted, received)) {
      const err = new Error('Polar webhook signature mismatch')
      err.status = 400
      throw err
    }

    return JSON.parse(rawBody.toString('utf8'))
  },
}

module.exports = polar
