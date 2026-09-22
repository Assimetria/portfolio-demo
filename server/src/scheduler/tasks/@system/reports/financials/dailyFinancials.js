'use strict'
const BaseTask = require('../../base/BaseTask')
const logger = require('../../../../../lib/@system/Logger')
const db = require('../../../../../lib/@system/PostgreSQL')

class DailyFinancialsReportTask extends BaseTask {
  constructor() { super('daily_financials_report', true, { module: 'billing' }) }
  getSchedule() { return '30 23 * * *' } // Daily 11:30 PM

  async execute() {
    // Stub: requires Stripe + SES for full implementation
    // Full version calculates: MRR, active subscribers, churn, ARPU, LTV,
    // revenue projections (conservative/growth/optimistic), saves metrics to DB
    logger.info('[scheduler] daily financials report — skipped (no payment provider configured)')
    return { skipped: true, reason: 'payment_provider_not_configured' }
  }
}

module.exports = DailyFinancialsReportTask
