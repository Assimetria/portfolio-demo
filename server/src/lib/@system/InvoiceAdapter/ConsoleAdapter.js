// @system — Console fallback for invoicing (dev mode)
'use strict'

const logger = require('../Logger')

const ConsoleAdapter = {
  provider: 'console',

  async findClient(email) {
    logger.debug({ email }, '[InvoiceAdapter:console] findClient (dev)')
    return null
  },
  async createClient(data) {
    logger.debug({ data }, '[InvoiceAdapter:console] createClient (dev)')
    return { id: 'dev-client', ...data }
  },
  async createInvoice(opts) {
    logger.debug({ opts }, '[InvoiceAdapter:console] createInvoice (dev)')
    return { id: 'dev-invoice', ...opts }
  },
  health() {
    return { provider: 'console', configured: true, devMode: true }
  },
}

module.exports = ConsoleAdapter
