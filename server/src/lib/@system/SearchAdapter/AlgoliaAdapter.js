// @system — Algolia adapter
// Requires: ALGOLIA_APP_ID        — Algolia Application ID
//           ALGOLIA_API_KEY       — Algolia Admin API key (for indexing/deleting)
//           ALGOLIA_SEARCH_KEY    — Algolia Search-only API key (for public search)
//
// Install: npm install algoliasearch
'use strict'

const logger = require('../Logger')

let _adminClient = null
let _searchClient = null

function getAdminClient() {
  if (_adminClient) return _adminClient

  let algoliasearch
  try {
    algoliasearch = require('algoliasearch')
    // algoliasearch v5 uses named export; v4 uses default export
    if (typeof algoliasearch !== 'function') {
      algoliasearch = algoliasearch.algoliasearch ?? algoliasearch.default ?? algoliasearch
    }
  } catch {
    throw Object.assign(
      new Error('[SearchAdapter:algolia] "algoliasearch" package not installed. Run: npm install algoliasearch'),
      { status: 500 }
    )
  }

  const appId = process.env.ALGOLIA_APP_ID
  const apiKey = process.env.ALGOLIA_API_KEY

  if (!appId || !apiKey) {
    throw Object.assign(
      new Error('ALGOLIA_APP_ID and ALGOLIA_API_KEY are required'),
      { status: 500 }
    )
  }

  _adminClient = algoliasearch(appId, apiKey)
  return _adminClient
}

function getSearchClient() {
  if (_searchClient) return _searchClient

  let algoliasearch
  try {
    algoliasearch = require('algoliasearch')
    if (typeof algoliasearch !== 'function') {
      algoliasearch = algoliasearch.algoliasearch ?? algoliasearch.default ?? algoliasearch
    }
  } catch {
    throw Object.assign(
      new Error('[SearchAdapter:algolia] "algoliasearch" package not installed. Run: npm install algoliasearch'),
      { status: 500 }
    )
  }

  const appId = process.env.ALGOLIA_APP_ID
  // Use search-only key for queries; fall back to admin key in server context
  const key = process.env.ALGOLIA_SEARCH_KEY ?? process.env.ALGOLIA_API_KEY

  if (!appId || !key) {
    throw Object.assign(
      new Error('ALGOLIA_APP_ID and ALGOLIA_SEARCH_KEY (or ALGOLIA_API_KEY) are required'),
      { status: 500 }
    )
  }

  _searchClient = algoliasearch(appId, key)
  return _searchClient
}

const AlgoliaAdapter = {
  provider: 'algolia',

  /**
   * Perform a search query against an Algolia index.
   *
   * @param {{
   *   index: string,
   *   query: string,
   *   filters?: string,
   *   sort?: string[],
   *   limit?: number,
   *   offset?: number,
   *   attributesToRetrieve?: string[],
   * }} opts
   * @returns {Promise<{ hits: Object[], total: number, page: number, totalPages: number, processingTimeMs: number }>}
   */
  async search({ index, query, filters, limit = 20, offset = 0, attributesToRetrieve }) {
    const client = getSearchClient()
    const idx = client.initIndex(index)

    const hitsPerPage = limit
    const page = Math.floor(offset / limit)

    const searchParams = {
      hitsPerPage,
      page,
      ...(filters ? { filters } : {}),
      ...(attributesToRetrieve ? { attributesToRetrieve } : {}),
    }

    const result = await idx.search(query, searchParams)

    logger.debug(
      { index, query, hits: result.hits.length, total: result.nbHits },
      '[SearchAdapter:algolia] search complete'
    )

    return {
      hits: result.hits,
      total: result.nbHits,
      page: result.page + 1,
      totalPages: result.nbPages,
      processingTimeMs: result.processingTimeMS,
    }
  },

  /**
   * Index a single document (upsert by objectID).
   *
   * @param {{ index: string, id: string|number, document: Object }} opts
   * @returns {Promise<{ ok: boolean, objectID: string, taskID: number }>}
   */
  async indexDocument({ index, id, document }) {
    const client = getAdminClient()
    const idx = client.initIndex(index)

    const record = { objectID: String(id), ...document }
    const result = await idx.saveObject(record)

    logger.info({ index, objectID: result.objectID, taskID: result.taskID }, '[SearchAdapter:algolia] document indexed')
    return { ok: true, objectID: result.objectID, taskID: result.taskID }
  },

  /**
   * Index multiple documents in bulk.
   * Each document must have an `id` or `objectID` field.
   *
   * @param {{ index: string, documents: Object[] }} opts
   * @returns {Promise<{ ok: boolean, objectIDs: string[], taskID: number }>}
   */
  async indexDocuments({ index, documents }) {
    const client = getAdminClient()
    const idx = client.initIndex(index)

    const records = documents.map((doc) => ({
      objectID: String(doc.objectID ?? doc.id ?? ''),
      ...doc,
    }))

    const result = await idx.saveObjects(records)

    logger.info({ index, count: records.length }, '[SearchAdapter:algolia] documents indexed')
    return { ok: true, objectIDs: result.objectIDs, taskID: result.taskIDs?.[0] }
  },

  /**
   * Delete a single document from an Algolia index.
   *
   * @param {{ index: string, id: string|number }} opts
   * @returns {Promise<{ ok: boolean, taskID: number }>}
   */
  async deleteDocument({ index, id }) {
    const client = getAdminClient()
    const idx = client.initIndex(index)

    const result = await idx.deleteObject(String(id))

    logger.info({ index, id, taskID: result.taskID }, '[SearchAdapter:algolia] document deleted')
    return { ok: true, taskID: result.taskID }
  },

  /**
   * Delete an entire Algolia index.
   *
   * @param {string} uid  Index name
   * @returns {Promise<{ ok: boolean, taskID: number }>}
   */
  async deleteIndex(uid) {
    const client = getAdminClient()
    const idx = client.initIndex(uid)

    const result = await idx.delete()

    logger.info({ uid, taskID: result.taskID }, '[SearchAdapter:algolia] index deleted')
    return { ok: true, taskID: result.taskID }
  },

  /**
   * Configure an Algolia index (idempotent — creates or updates settings).
   *
   * @param {string} uid
   * @param {{ primaryKey?: string, searchableAttributes?: string[], attributesForFaceting?: string[] }} [opts]
   * @returns {Promise<{ ok: boolean, taskID: number }>}
   */
  async createIndex(uid, opts = {}) {
    const client = getAdminClient()
    const idx = client.initIndex(uid)

    const settings = {}
    if (opts.searchableAttributes) settings.searchableAttributes = opts.searchableAttributes
    if (opts.attributesForFaceting) settings.attributesForFaceting = opts.attributesForFaceting

    if (Object.keys(settings).length > 0) {
      const result = await idx.setSettings(settings)
      logger.info({ uid, settings, taskID: result.taskID }, '[SearchAdapter:algolia] index configured')
      return { ok: true, taskID: result.taskID }
    }

    // No settings to apply — index is lazily created on first document insert
    logger.info({ uid }, '[SearchAdapter:algolia] createIndex called — index will be created on first document')
    return { ok: true }
  },

  /**
   * Return health info for this adapter.
   */
  health() {
    const appId = process.env.ALGOLIA_APP_ID ?? null
    const hasAdminKey = !!process.env.ALGOLIA_API_KEY
    const hasSearchKey = !!process.env.ALGOLIA_SEARCH_KEY
    const configured = !!(appId && hasAdminKey)

    let packageAvailable = true
    try { require('algoliasearch') } catch { packageAvailable = false }

    return {
      provider: 'algolia',
      configured,
      packageAvailable,
      appId,
      hasAdminKey,
      hasSearchKey,
      envVars: ['ALGOLIA_APP_ID', 'ALGOLIA_API_KEY', 'ALGOLIA_SEARCH_KEY'],
    }
  },
}

module.exports = AlgoliaAdapter
