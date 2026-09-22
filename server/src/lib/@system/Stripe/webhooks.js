// @system — StripeService: Webhook digest + handlers (checkout, subscription lifecycle, invoice).
// Mixed into StripeService.prototype (see StripeService.js).
'use strict'

const stripe = require('./index')
const logger = require('../Logger')

const CREDITS_MULTIPLIER = Number(process.env.CREDITS_MULTIPLIER) || 1

module.exports = {
  // ── Webhook digest — main entry point ────────────────────────────────────
  // Parses the raw Stripe event and returns a normalized action object
  // for the webhook handler lambda to process.

  async digest(rawBody, signature) {
    try {
      if (!signature) {
        logger.error('No Stripe signature in webhook request')
        return null
      }
      let event
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, this.endpointSecret)
      } catch (err) {
        logger.error({ err: err.message }, 'Stripe webhook signature verification failed')
        return null
      }

      const obj = event.data.object
      if (!obj) { logger.error('No object data in webhook event'); return null }

      switch (event.type) {
        case 'checkout.session.completed':
          return this._handleCheckoutCompleted(obj)
        case 'customer.subscription.deleted':
          return this._handleSubscriptionDeleted(obj)
        case 'customer.subscription.updated':
          return this._handleSubscriptionUpdated(obj, event.data.previous_attributes)
        case 'invoice.payment_succeeded':
          return this._handleInvoicePaymentSucceeded(obj)
        default:
          return null
      }
    } catch (err) {
      logger.error({ err }, 'Error in Stripe webhook digest')
      return null
    }
  },

  // ── Checkout completed ───────────────────────────────────────────────────

  async _handleCheckoutCompleted(obj) {
    if (obj.subscription) return this._handleSubscriptionCheckout(obj)
    return this._handleOneTimeCheckout(obj)
  },

  async _handleSubscriptionCheckout(obj) {
    const subscription = await this.getSubscription(obj.subscription)
    const customer = await this.getCustomer(subscription.customer)
    const product = await this.getProduct(subscription.plan.product)

    const isActive = subscription.status === 'active' || subscription.status === 'trialing'
    const quantity = subscription.items?.data?.[0]?.quantity || 1
    let actualPrice = obj.amount_subtotal
    if (obj.discount) {
      actualPrice = obj.amount_subtotal * (1 - obj.discount.coupon.percent_off / 100)
    }

    const isCreditsPurchase = this._isCreditsPurchase(obj, product)
    const baseCredits = this._calculateCredits(obj)
    const credits = baseCredits * quantity
    const periodEnd = this.getCurrentPeriodEnd(subscription)

    return {
      action: 'create',
      externalId: subscription?.id || obj.id,
      country: this._extractCountry(customer, obj),
      name: customer.name,
      email: customer.email.toLowerCase().trim(),
      price: actualPrice,
      periodicity: this._normalizePeriodicity(subscription?.plan?.interval),
      isActive,
      status: subscription.status,
      image: product.images?.[0],
      sessionId: obj.client_reference_id,
      endDate: periodEnd ? new Date(periodEnd * 1000) : null,
      type: obj.mode,
      credits,
      isCreditsPurchase,
      customFields: this._getCustomFields(obj),
      metadata: obj.metadata,
    }
  },

  async _handleOneTimeCheckout(obj) {
    let paymentLink = null
    try { if (obj.payment_link) paymentLink = await stripe.paymentLinks.retrieve(obj.payment_link) } catch (_) {}
    const isCreditsPurchase = this._isCreditsPurchase(obj, null, paymentLink)
    const credits = this._calculateCredits(obj)

    return {
      action: 'create',
      externalId: obj.id,
      country: obj.customer_details?.address?.country,
      name: obj.customer_details?.name,
      email: obj.customer_details.email.toLowerCase().trim(),
      price: obj.amount_total,
      periodicity: 'one-time',
      isActive: false,
      isCreditsPurchase,
      credits,
      sessionId: obj.client_reference_id,
      type: obj.mode,
      customFields: this._getCustomFields(obj),
      metadata: { ...obj.metadata, customFields: this._getCustomFields(obj) },
    }
  },

  // ── Subscription deleted ─────────────────────────────────────────────────

  async _handleSubscriptionDeleted(obj) {
    const customer = await this.getCustomer(obj.customer)
    const periodEnd = this.getCurrentPeriodEnd(obj)
    const baseData = { externalId: obj.id, country: this._extractCountry(customer, obj), name: customer.name, email: customer.email.toLowerCase().trim() }

    // Look up existing metadata in DB
    const SubscriptionRepo = require('../../../db/repos/@system/SubscriptionRepo')
    let existingMeta = {}
    try {
      const existing = await SubscriptionRepo.findByExternalId(obj.id)
      if (existing?.metadata) existingMeta = existing.metadata
    } catch (_) {}

    const { type, reason } = this._mapCancellationReason(obj)
    return {
      action: 'canceled',
      ...baseData,
      endDate: periodEnd ? new Date(periodEnd * 1000) : null,
      status: 'canceled',
      metadata: this._createCancellationMetadata(obj, type, reason, existingMeta),
    }
  },

  // ── Subscription updated ─────────────────────────────────────────────────

  async _handleSubscriptionUpdated(obj, previousAttributes = null) {
    const customer = await this.getCustomer(obj.customer)
    const product = obj.plan?.product ? await this.getProduct(obj.plan.product) : null

    const SubscriptionRepo = require('../../../db/repos/@system/SubscriptionRepo')
    let existingMeta = {}
    try {
      const existing = await SubscriptionRepo.findByExternalId(obj.id)
      if (existing?.metadata) existingMeta = existing.metadata
    } catch (_) {}

    const quantity = obj.items?.data?.[0]?.quantity || 1
    const rawAmount = obj.plan?.amount || obj.amount_total || 0
    const baseCredits = parseInt(rawAmount * CREDITS_MULTIPLIER / 100) || 0
    const credits = baseCredits * quantity
    const periodEnd = this.getCurrentPeriodEnd(obj)
    const baseData = { externalId: obj.id, country: this._extractCountry(customer, obj), name: customer.name, email: customer.email.toLowerCase().trim() }

    // Credits deferred to invoice.payment_succeeded — never award in subscription updates
    const effectiveCredits = 0

    // Check for scheduled cancellation
    if (obj.cancel_at_period_end) {
      return {
        action: 'canceled',
        ...baseData,
        cancelDate: new Date(obj.cancel_at * 1000),
        endDate: periodEnd ? new Date(periodEnd * 1000) : null,
        status: 'canceled',
        metadata: this._createCancellationMetadata(obj, 'manual_cancellation', 'user_scheduled_cancellation', existingMeta),
      }
    }

    // Payment failures — don't extend end date
    if (obj.status === 'past_due' || obj.status === 'unpaid') {
      const { type, reason } = obj.status === 'past_due'
        ? { type: 'payment_failed', reason: 'payment_overdue' }
        : { type: 'payment_failed', reason: 'payment_unpaid' }
      return {
        action: 'update',
        ...baseData,
        last_renew: new Date(),
        status: 'active', // keep active — user retains access during grace period
        metadata: this._createCancellationMetadata(obj, type, reason, existingMeta),
      }
    }

    // Draft invoices — don't extend end date
    let isDraft = false
    if (obj.latest_invoice) {
      try {
        const inv = await this.getInvoice(obj.latest_invoice)
        isDraft = inv.status === 'draft'
      } catch (_) {}
    }
    if (isDraft) {
      return {
        action: 'update', ...baseData,
        last_renew: new Date(),
        status: obj.status || 'active',
        metadata: obj.metadata || {},
      }
    }

    // Incomplete / expired
    if (obj.status === 'incomplete' || obj.status === 'incomplete_expired') {
      const reason = obj.status === 'incomplete' ? 'incomplete_payment' : 'incomplete_expired'
      return {
        action: 'canceled', ...baseData,
        endDate: periodEnd ? new Date(periodEnd * 1000) : null,
        status: 'expired',
        metadata: this._createCancellationMetadata(obj, 'checkout_incomplete', reason, existingMeta),
      }
    }

    // Fully canceled
    if (obj.status === 'canceled') {
      const { type, reason } = this._mapCancellationReason(obj)
      return {
        action: 'canceled', ...baseData,
        cancelDate: obj.canceled_at ? new Date(obj.canceled_at * 1000) : new Date(),
        endDate: periodEnd ? new Date(periodEnd * 1000) : null,
        status: 'canceled',
        metadata: this._createCancellationMetadata(obj, type, reason, existingMeta),
      }
    }

    // Active / trialing / plan change
    return {
      action: 'update',
      ...baseData,
      price: obj.plan?.amount,
      periodicity: this._normalizePeriodicity(obj.plan?.interval),
      credits: effectiveCredits,
      isCreditsPurchase: false,
      isActive: obj.status === 'active' || obj.status === 'trialing',
      status: obj.status,
      image: product?.images?.[0],
      last_renew: new Date(this.getCurrentPeriodStart(obj) * 1000),
      endDate: periodEnd ? new Date(periodEnd * 1000) : null,
      skipTransaction: true,
      metadata: obj.metadata || {},
    }
  },

  // ── Invoice payment succeeded (credit awarding) ─────────────────────────

  async _handleInvoicePaymentSucceeded(obj) {
    const subscriptionId = obj.subscription || obj.parent?.subscription_details?.subscription
    if (!subscriptionId) return null

    try {
      const subscription = await this.getSubscription(subscriptionId)
      const customer = await this.getCustomer(subscription.customer)
      const product = subscription.plan?.product ? await this.getProduct(subscription.plan.product) : null

      const quantity = subscription.items?.data?.[0]?.quantity || 1
      const rawAmount = subscription.plan?.amount || 0
      const baseCredits = parseInt(rawAmount * CREDITS_MULTIPLIER / 100) || 0
      const credits = baseCredits * quantity
      const isCreditsPurchase = this._isCreditsPurchase(subscription, product)
      const periodEnd = this.getCurrentPeriodEnd(subscription)

      return {
        action: 'payment_succeeded',
        externalId: subscription.id,
        country: this._extractCountry(customer),
        name: customer.name,
        email: customer.email.toLowerCase().trim(),
        price: (subscription.plan?.amount || 0) * quantity,
        periodicity: this._normalizePeriodicity(subscription.plan?.interval),
        credits,
        isCreditsPurchase,
        isActive: true,
        status: subscription.status,
        image: product?.images?.[0],
        last_renew: new Date(),
        endDate: periodEnd ? new Date(periodEnd * 1000) : null,
        invoiceId: obj.id,
        metadata: subscription.metadata || {},
      }
    } catch (err) {
      logger.error({ err, invoiceId: obj.id }, 'error handling payment succeeded')
      return null
    }
  },

  // ── Credit-worthy change detection ───────────────────────────────────────

  shouldAwardCreditsForUpdate(previousAttributes, obj) {
    if (!previousAttributes || Object.keys(previousAttributes).length === 0) return false

    const changed = Object.keys(previousAttributes)
    const creditWorthy = ['current_period_end', 'current_period_start', 'items', 'plan']
    const hasBillingChange = changed.some((f) => creditWorthy.includes(f))

    if (previousAttributes.status && changed.includes('status')) {
      const transition = `${previousAttributes.status} → ${obj.status}`
      const worthy = [
        'past_due → active', 'unpaid → active', 'incomplete → active',
        'incomplete_expired → active', 'canceled → active', 'canceled → trialing',
        'trialing → active',
      ]
      if (worthy.includes(transition)) return true
      if (!hasBillingChange) return false
    }

    return hasBillingChange
  },
}
