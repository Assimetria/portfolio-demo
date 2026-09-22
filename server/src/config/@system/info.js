// @system — server-side product config
// Reads from .config/info.js (shared source of truth) and merges server defaults.
const path = require('path')

let sharedInfo = {}
try {
  sharedInfo = require(path.join(__dirname, '../../../../.config/info.js'))
} catch {
  // .config/info.js not found — use defaults only
}

module.exports = {
  ...sharedInfo,
  version: '0.1.0',
  env: process.env.NODE_ENV ?? 'development',
  // Server-specific overrides
  url: process.env.APP_URL ?? sharedInfo.url ?? 'http://localhost:3001',
}
