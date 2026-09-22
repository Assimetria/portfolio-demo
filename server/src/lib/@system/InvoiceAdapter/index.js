// @system — Unified Invoice Adapter
// Abstracts invoicing providers behind a single interface.
// Currently supports InvoiceXpress (mirroring Asymetric Ventures' integration).
// Switch providers by setting INVOICE_PROVIDER=invoicexpress|console
//
// Usage:
//   const InvoiceAdapter = require('../InvoiceAdapter')
//   const invoice = await InvoiceAdapter.createInvoice({ ... })

'use strict'

const InvoiceXpressAdapter = require('./InvoiceXpressAdapter')
const ConsoleAdapter       = require('./ConsoleAdapter')
const logger               = require('../Logger')

const ADAPTERS = { invoicexpress: InvoiceXpressAdapter, console: ConsoleAdapter }

function resolveProvider() {
  const explicit = (process.env.INVOICE_PROVIDER ?? '').toLowerCase()
  if (explicit && ADAPTERS[explicit]) return explicit
  if (process.env.INVOICEXPRESS_API_KEY && process.env.INVOICEXPRESS_ACCOUNT) return 'invoicexpress'
  return 'console'
}

function getAdapter() {
  return ADAPTERS[resolveProvider()]
}

const InvoiceAdapter = {
  get provider() { return resolveProvider() },

  createInvoice(opts) { return getAdapter().createInvoice(opts) },
  findClient(email)   { return getAdapter().findClient(email) },
  createClient(data)  { return getAdapter().createClient(data) },

  health() { return getAdapter().health() },
  healthAll() {
    return Object.fromEntries(
      Object.entries(ADAPTERS).map(([name, adapter]) => [name, adapter.health()])
    )
  },
}

module.exports = InvoiceAdapter
