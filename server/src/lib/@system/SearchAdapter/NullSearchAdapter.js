// @system — Null search adapter (no-op fallback)
// Used when SEARCH_PROVIDER=none or no search env vars are configured.
// All operations succeed silently — safe for local dev without a search backend.
'use strict'

const logger = require('../Logger')

const NullSearchAdapter = {
  provider: 'none',

  /**
   * No-op search — returns empty results.
   * @param {{ index: string, query: string, filters?: string, limit?: number, offset?: number }} opts
   * @returns {Promise<{ hits: [], total: number, page: number, totalPages: number }>}
   */
  async search({ index, query }) {
    logger.debug({ index, query }, '[SearchAdapter:none] search called — no provider configured')
    return { hits: [], total: 0, page: 1, totalPages: 0, processingTimeMs: 0 }
  },

  /**
   * No-op index single document.
   */
  async indexDocument({ index, id }) {
    logger.debug({ index, id }, '[SearchAdapter:none] indexDocument called — no provider configured')
    return { ok: true, devMode: true }
  },

  /**
   * No-op index multiple documents.
   */
  async indexDocuments({ index, documents }) {
    logger.debug({ index, count: documents?.length }, '[SearchAdapter:none] indexDocuments called — no provider configured')
    return { ok: true, devMode: true }
  },

  /**
   * No-op delete document.
   */
  async deleteDocument({ index, id }) {
    logger.debug({ index, id }, '[SearchAdapter:none] deleteDocument called — no provider configured')
    return { ok: true, devMode: true }
  },

  /**
   * No-op delete index.
   */
  async deleteIndex(uid) {
    logger.debug({ uid }, '[SearchAdapter:none] deleteIndex called — no provider configured')
    return { ok: true, devMode: true }
  },

  /**
   * No-op create/configure index.
   */
  async createIndex(uid) {
    logger.debug({ uid }, '[SearchAdapter:none] createIndex called — no provider configured')
    return { ok: true, devMode: true }
  },

  health() {
    return { provider: 'none', configured: false, devMode: true }
  },
}

module.exports = NullSearchAdapter
