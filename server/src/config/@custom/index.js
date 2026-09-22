// @custom — product-specific server config override
// Merge/override values from @system/info.js here.
// This file is NEVER overwritten during template sync.

const systemInfo = require('../@system/info')

const customInfo = {
  name: 'Product Template',
  url: process.env.APP_URL ?? 'http://localhost:3001',
  supportEmail: 'hello@producttemplate.com',
}

module.exports = { ...systemInfo, ...customInfo }
