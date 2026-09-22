// @system — InvoiceXpress invoice adapter
// Mirrors Asymetric Ventures' InvoiceXpress integration.
// Required env vars:
//   INVOICEXPRESS_ACCOUNT  — Account name (e.g. 'mycompany')
//   INVOICEXPRESS_API_KEY  — API key
'use strict'

const https = require('https')
const logger = require('../Logger')

function makeRequest(method, endpoint, data = null) {
  const account = process.env.INVOICEXPRESS_ACCOUNT
  const apiKey  = process.env.INVOICEXPRESS_API_KEY
  if (!account || !apiKey) throw new Error('InvoiceXpress not configured')

  const separator = endpoint.includes('?') ? '&' : '?'
  const baseUrl = `https://${account}.app.invoicexpress.com`
  const url = new URL(`${baseUrl}${endpoint}${separator}api_key=${apiKey}`)

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    }, (res) => {
      let body = ''
      res.on('data', chunk => { body += chunk })
      res.on('end', () => {
        try {
          const parsed = body.trim() ? JSON.parse(body) : {}
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed)
          } else {
            reject(new Error(`InvoiceXpress ${res.statusCode}: ${body}`))
          }
        } catch (err) {
          reject(err)
        }
      })
    })
    req.on('error', reject)
    if (data) req.write(JSON.stringify(data))
    req.end()
  })
}

const InvoiceXpressAdapter = {
  provider: 'invoicexpress',

  async findClient(email) {
    try {
      const response = await makeRequest('GET', `/clients/find-by-name.json?client_name=${encodeURIComponent(email)}`)
      return response.client || response.clients?.[0] || null
    } catch {
      return null
    }
  },

  async createClient({ name, email, fiscalId, country, address, city, postalCode }) {
    try {
      const response = await makeRequest('POST', '/clients.json', {
        client: {
          name: name || email,
          email,
          fiscal_id: fiscalId,
          country, address, city, postal_code: postalCode,
        },
      })
      logger.info({ email }, '[InvoiceAdapter:invoicexpress] client created')
      return response.client
    } catch (err) {
      logger.error({ err, email }, '[InvoiceAdapter:invoicexpress] createClient failed')
      throw err
    }
  },

  async createInvoice({ clientId, items, date, dueDate, currency = 'USD' }) {
    try {
      const response = await makeRequest('POST', '/invoices.json', {
        invoice: {
          date: date || new Date().toISOString().split('T')[0],
          due_date: dueDate,
          client_id: clientId,
          currency,
          items: items.map(item => ({
            name: item.name,
            description: item.description,
            unit_price: item.unitPrice,
            quantity: item.quantity || 1,
            tax: item.tax,
          })),
        },
      })
      logger.info({ invoiceId: response.invoice?.id }, '[InvoiceAdapter:invoicexpress] invoice created')
      return response.invoice
    } catch (err) {
      logger.error({ err }, '[InvoiceAdapter:invoicexpress] createInvoice failed')
      throw err
    }
  },

  health() {
    return {
      provider: 'invoicexpress',
      configured: !!(process.env.INVOICEXPRESS_ACCOUNT && process.env.INVOICEXPRESS_API_KEY),
      envVars: ['INVOICEXPRESS_ACCOUNT', 'INVOICEXPRESS_API_KEY'],
    }
  },
}

module.exports = InvoiceXpressAdapter
