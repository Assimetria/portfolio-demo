'use strict'
const BaseTask = require('../base/BaseTask')
const logger = require('../../../../lib/@system/Logger')

class DailyInvoiceGenerationTask extends BaseTask {
  constructor() { super('daily_invoice_generation', true, { module: 'billing' }) }
  getSchedule() { return '0 2 * * *' } // Daily 2 AM

  async execute() {
    // Stub: requires Stripe + InvoiceXpress/SES configuration
    // Full implementation mirrors Ventures: fetch yesterday's payments,
    // create invoices, handle refunds as credit notes, send completion email
    logger.info('[scheduler] daily invoice generation — skipped (no payment provider configured)')
    return { skipped: true, reason: 'payment_provider_not_configured' }
  }
}

module.exports = DailyInvoiceGenerationTask
