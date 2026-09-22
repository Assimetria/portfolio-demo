// @system — StripeService: Payment / Refund queries + tax extraction from invoices.
// Mixed into StripeService.prototype (see StripeService.js).
'use strict'

const stripe = require('./index')
const logger = require('../Logger')

module.exports = {
  // ── Payment / Refund queries ─────────────────────────────────────────────

  async getPaymentsForDateRange(startDate, endDate) {
    const gte = Math.floor(startDate.getTime() / 1000)
    const lte = Math.floor(endDate.getTime() / 1000)
    let all = [], hasMore = true, startingAfter = null

    while (hasMore) {
      const params = { created: { gte, lte }, limit: 100 }
      if (startingAfter) params.starting_after = startingAfter
      const charges = await stripe.charges.list(params)
      all = all.concat(charges.data)
      hasMore = charges.has_more
      if (hasMore && charges.data.length) startingAfter = charges.data[charges.data.length - 1].id
    }
    return all.filter((c) => c.status === 'succeeded' && c.paid && !c.refunded)
  },

  async getRefundsForDateRange(startDate, endDate) {
    const gte = Math.floor(startDate.getTime() / 1000)
    const lte = Math.floor(endDate.getTime() / 1000)
    let all = [], hasMore = true, startingAfter = null

    while (hasMore) {
      const params = { created: { gte, lte }, limit: 100 }
      if (startingAfter) params.starting_after = startingAfter
      const refunds = await stripe.refunds.list(params)
      all = all.concat(refunds.data)
      hasMore = refunds.has_more
      if (hasMore && refunds.data.length) startingAfter = refunds.data[refunds.data.length - 1].id
    }
    return Promise.all(
      all.map(async (refund) => {
        try {
          return { refund, originalCharge: await stripe.charges.retrieve(refund.charge) }
        } catch (_) {
          return { refund, originalCharge: null }
        }
      }),
    )
  },

  async getPaymentDataForDateRange(startDate, endDate) {
    const [payments, refunds] = await Promise.all([
      this.getPaymentsForDateRange(startDate, endDate),
      this.getRefundsForDateRange(startDate, endDate),
    ])
    return { payments, refunds, startDate, endDate }
  },

  // ── Tax extraction from invoices ─────────────────────────────────────────

  async getPaymentTaxInfo(payment) {
    try {
      if (payment.invoice) {
        const invoice = await stripe.invoices.retrieve(payment.invoice)
        return { hasInvoice: true, invoice, taxInfo: this.extractTaxInfoFromInvoice(invoice) }
      }
      return { hasInvoice: false, invoice: null, taxInfo: null }
    } catch (err) {
      logger.error({ err, paymentId: payment.id }, 'error getting tax info')
      return { hasInvoice: false, invoice: null, taxInfo: null, error: err.message }
    }
  },

  extractTaxInfoFromInvoice(invoice) {
    try {
      const info = {
        totalTax: invoice.tax || 0,
        totalTaxAmounts: invoice.total_tax_amounts || [],
        totalTaxes: invoice.total_taxes || [],
        defaultTaxRates: invoice.default_tax_rates || [],
        automaticTax: invoice.automatic_tax || null,
        taxRate: null, taxPercentage: null, calculatedTaxPercentage: null,
        taxAmount: 0, taxableAmount: 0, isInclusive: false, isReverseCharge: false,
        subtotal: invoice.subtotal || 0, total: invoice.total || 0,
        customerTaxExempt: invoice.customer_tax_exempt || 'none',
        customerTaxIds: invoice.customer_tax_ids || [],
      }

      // total_tax_amounts (most accurate)
      if (invoice.total_tax_amounts?.length > 0) {
        const t = invoice.total_tax_amounts[0]
        info.taxAmount = t.amount || 0
        info.taxableAmount = t.taxable_amount || 0
        info.isInclusive = t.inclusive || false
        if (info.taxableAmount > 0) info.calculatedTaxPercentage = Math.round((info.taxAmount / info.taxableAmount) * 100)
        if (t.tax_rate) { info.taxRate = t.tax_rate; info.taxPercentage = t.tax_rate.percentage }
      }

      // total_taxes fallback
      if (invoice.total_taxes?.length > 0 && !info.taxAmount) {
        const t = invoice.total_taxes[0]
        info.taxAmount = t.amount || 0
        info.taxableAmount = t.taxable_amount || 0
        info.isInclusive = t.tax_behavior === 'inclusive'
        if (info.taxableAmount > 0) info.calculatedTaxPercentage = Math.round((info.taxAmount / info.taxableAmount) * 100)
      }

      // default_tax_rates fallback
      if (!info.taxPercentage && !info.calculatedTaxPercentage && invoice.default_tax_rates?.length > 0) {
        info.taxRate = invoice.default_tax_rates[0]
        info.taxPercentage = invoice.default_tax_rates[0].percentage
      }

      // Reverse charge detection
      if (info.taxAmount === 0 && (info.taxPercentage > 0 || info.calculatedTaxPercentage > 0)) {
        info.isReverseCharge = true
      }
      if (info.customerTaxIds?.some((t) => t.type === 'eu_vat' && t.verification?.status === 'verified') && info.taxAmount === 0) {
        info.isReverseCharge = true
      }

      return info
    } catch (err) {
      logger.error({ err }, 'error extracting tax info from invoice')
      return null
    }
  },
}
