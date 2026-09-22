// @system — Unified Search Adapter
// Abstracts Meilisearch and Algolia behind a single interface.
// Switch providers by setting SEARCH_PROVIDER=meilisearch|algolia|none
// (default: auto-detects based on configured env vars; falls back to none).
//
// Usage:
//   const Search = require('../SearchAdapter')
//
//   // Search
//   const { hits, total } = await Search.search({ index: 'products', query: 'headphones' })
//
//   // Index documents
//   await Search.indexDocuments({ index: 'products', documents: [{ id: '1', name: 'Headphones' }] })
//
//   // Delete a document
//   await Search.deleteDocument({ index: 'products', id: '1' })
//
// Environment variables:
//   SEARCH_PROVIDER       — 'meilisearch' | 'algolia' | 'none' (auto-detect if unset)
//   MEILISEARCH_HOST      — e.g. http://localhost:7700
//   MEILISEARCH_API_KEY   — Meilisearch master/admin key
//   ALGOLIA_APP_ID        — Algolia Application ID
//   ALGOLIA_API_KEY       — Algolia Admin API key
//   ALGOLIA_SEARCH_KEY    — Algolia Search-only API key (for public queries)

'use strict'

const MeilisearchAdapter = require('./MeilisearchAdapter')
const AlgoliaAdapter     = require('./AlgoliaAdapter')
const NullSearchAdapter  = require('./NullSearchAdapter')

const ADAPTERS = {
  meilisearch: MeilisearchAdapter,
  algolia:     AlgoliaAdapter,
  none:        NullSearchAdapter,
}

/**
 * @typedef {Object} SearchOptions
 * @property {string}   index                  Index / index name to search
 * @property {string}   query                  Search query string
 * @property {string}   [filters]              Filter expression (provider-specific syntax)
 * @property {string[]} [sort]                 Sort rules (e.g. ['price:asc'])
 * @property {number}   [limit]                Max results to return (default: 20)
 * @property {number}   [offset]               Offset for pagination (default: 0)
 * @property {string[]} [attributesToRetrieve] Specific fields to return
 *
 * @typedef {Object} SearchResult
 * @property {Object[]} hits            Result documents
 * @property {number}   total           Total matching documents
 * @property {number}   page            Current page (1-based)
 * @property {number}   totalPages      Total pages
 * @property {number}   [processingTimeMs]  Search processing time in ms
 *
 * @typedef {Object} IndexOptions
 * @property {string}         index       Index name
 * @property {string|number}  id          Document ID
 * @property {Object}         document    Document payload
 *
 * @typedef {Object} BulkIndexOptions
 * @property {string}   index      Index name
 * @property {Object[]} documents  Array of documents (each must have an `id` or `objectID` field)
 */

/** @returns {'meilisearch'|'algolia'|'none'} */
function resolveProvider() {
  const explicit = (process.env.SEARCH_PROVIDER ?? '').toLowerCase()
  if (explicit && ADAPTERS[explicit]) return explicit

  // Auto-detect: pick first configured provider
  if (process.env.MEILISEARCH_HOST)  return 'meilisearch'
  if (process.env.ALGOLIA_APP_ID)    return 'algolia'
  return 'none'
}

function getAdapter() {
  return ADAPTERS[resolveProvider()]
}

const SearchAdapter = {
  /** Which provider is currently active */
  get provider() { return resolveProvider() },

  /**
   * Perform a full-text search.
   * @param {SearchOptions} opts
   * @returns {Promise<SearchResult>}
   */
  search(opts) {
    return getAdapter().search(opts)
  },

  /**
   * Index (upsert) a single document.
   * @param {IndexOptions} opts
   * @returns {Promise<{ ok: boolean, taskUid?: number, taskID?: number, objectID?: string }>}
   */
  indexDocument(opts) {
    return getAdapter().indexDocument(opts)
  },

  /**
   * Index (upsert) multiple documents in bulk.
   * Each document should have an `id` or `objectID` field.
   * @param {BulkIndexOptions} opts
   * @returns {Promise<{ ok: boolean }>}
   */
  indexDocuments(opts) {
    return getAdapter().indexDocuments(opts)
  },

  /**
   * Delete a single document from an index.
   * @param {{ index: string, id: string|number }} opts
   * @returns {Promise<{ ok: boolean }>}
   */
  deleteDocument(opts) {
    return getAdapter().deleteDocument(opts)
  },

  /**
   * Delete an entire index.
   * @param {string} uid  Index name / UID
   * @returns {Promise<{ ok: boolean }>}
   */
  deleteIndex(uid) {
    return getAdapter().deleteIndex(uid)
  },

  /**
   * Create or configure an index.
   * @param {string} uid
   * @param {{ primaryKey?: string, searchableAttributes?: string[], attributesForFaceting?: string[] }} [opts]
   * @returns {Promise<{ ok: boolean }>}
   */
  createIndex(uid, opts) {
    return getAdapter().createIndex(uid, opts)
  },

  /**
   * Return health and config info for the active adapter.
   */
  health() {
    return getAdapter().health()
  },

  /**
   * Return health info for ALL registered adapters.
   */
  healthAll() {
    return Object.fromEntries(
      Object.entries(ADAPTERS).map(([name, adapter]) => [name, adapter.health()])
    )
  },
}

module.exports = SearchAdapter
