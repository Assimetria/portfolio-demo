// @system — Meilisearch adapter
// Requires: MEILISEARCH_HOST (e.g. http://localhost:7700)
//           MEILISEARCH_API_KEY (master key or admin key)
//
// Install: npm install meilisearch
'use strict'

const logger = require('../Logger')

let _client = null

function getClient() {
  if (_client) return _client

  let MeiliSearch
  try {
    MeiliSearch = require('meilisearch').MeiliSearch
  } catch {
    throw Object.assign(
      new Error('[SearchAdapter:meilisearch] "meilisearch" package not installed. Run: npm install meilisearch'),
      { status: 500 }
    )
  }

  const host = process.env.MEILISEARCH_HOST
  if (!host) {
    throw Object.assign(new Error('MEILISEARCH_HOST is not configured'), { status: 500 })
  }

  _client = new MeiliSearch({
    host,
    apiKey: process.env.MEILISEARCH_API_KEY ?? '',
  })

  return _client
}

const MeilisearchAdapter = {
  provider: 'meilisearch',

  /**
   * Perform a search query against a Meilisearch index.
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
  async search({ index, query, filters, sort, limit = 20, offset = 0, attributesToRetrieve }) {
    const client = getClient()
    const idx = client.index(index)

    const searchParams = {
      limit,
      offset,
      ...(filters ? { filter: filters } : {}),
      ...(sort ? { sort } : {}),
      ...(attributesToRetrieve ? { attributesToRetrieve } : {}),
    }

    const result = await idx.search(query, searchParams)

    logger.debug(
      { index, query, hits: result.hits.length, total: result.estimatedTotalHits },
      '[SearchAdapter:meilisearch] search complete'
    )

    return {
      hits: result.hits,
      total: result.estimatedTotalHits ?? result.nbHits ?? result.hits.length,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil((result.estimatedTotalHits ?? result.hits.length) / limit),
      processingTimeMs: result.processingTimeMs,
    }
  },

  /**
   * Index a single document.
   *
   * @param {{ index: string, id: string|number, document: Object }} opts
   * @returns {Promise<{ ok: boolean, taskUid: number }>}
   */
  async indexDocument({ index, id, document }) {
    const client = getClient()
    const idx = client.index(index)

    const doc = { id, ...document }
    const task = await idx.addDocuments([doc])

    logger.info({ index, id, taskUid: task.taskUid }, '[SearchAdapter:meilisearch] document indexed')
    return { ok: true, taskUid: task.taskUid }
  },

  /**
   * Index multiple documents in bulk.
   *
   * @param {{ index: string, documents: Object[] }} opts
   * @returns {Promise<{ ok: boolean, taskUid: number }>}
   */
  async indexDocuments({ index, documents }) {
    const client = getClient()
    const idx = client.index(index)

    const task = await idx.addDocuments(documents)

    logger.info({ index, count: documents.length, taskUid: task.taskUid }, '[SearchAdapter:meilisearch] documents indexed')
    return { ok: true, taskUid: task.taskUid }
  },

  /**
   * Delete a single document from an index.
   *
   * @param {{ index: string, id: string|number }} opts
   * @returns {Promise<{ ok: boolean, taskUid: number }>}
   */
  async deleteDocument({ index, id }) {
    const client = getClient()
    const idx = client.index(index)

    const task = await idx.deleteDocument(id)

    logger.info({ index, id, taskUid: task.taskUid }, '[SearchAdapter:meilisearch] document deleted')
    return { ok: true, taskUid: task.taskUid }
  },

  /**
   * Delete an entire Meilisearch index.
   *
   * @param {string} uid  Index uid
   * @returns {Promise<{ ok: boolean, taskUid: number }>}
   */
  async deleteIndex(uid) {
    const client = getClient()
    const task = await client.deleteIndex(uid)

    logger.info({ uid, taskUid: task.taskUid }, '[SearchAdapter:meilisearch] index deleted')
    return { ok: true, taskUid: task.taskUid }
  },

  /**
   * Create a Meilisearch index (idempotent — already existing indexes are fine).
   *
   * @param {string} uid
   * @param {{ primaryKey?: string }} [opts]
   * @returns {Promise<{ ok: boolean, taskUid?: number }>}
   */
  async createIndex(uid, { primaryKey = 'id' } = {}) {
    const client = getClient()

    try {
      const task = await client.createIndex(uid, { primaryKey })
      logger.info({ uid, primaryKey, taskUid: task.taskUid }, '[SearchAdapter:meilisearch] index created')
      return { ok: true, taskUid: task.taskUid }
    } catch (err) {
      // Index already exists — treat as success
      if (err?.cause?.code === 'index_already_exists' || err?.body?.code === 'index_already_exists') {
        return { ok: true }
      }
      throw err
    }
  },

  /**
   * Return health info for this adapter.
   */
  health() {
    const host = process.env.MEILISEARCH_HOST ?? null
    const hasApiKey = !!process.env.MEILISEARCH_API_KEY
    const configured = !!host

    let packageAvailable = true
    try { require('meilisearch') } catch { packageAvailable = false }

    return {
      provider: 'meilisearch',
      configured,
      packageAvailable,
      host,
      hasApiKey,
      envVars: ['MEILISEARCH_HOST', 'MEILISEARCH_API_KEY'],
    }
  },
}

module.exports = MeilisearchAdapter
