// @system — Search API routes
// Exposes unified search and indexing operations backed by SearchAdapter (Meilisearch / Algolia / none).
//
// GET    /api/search                     — Full-text search query (authenticated)
// GET    /api/search/health              — Health & config info for active adapter (admin only)
// GET    /api/search/health/all          — Health info for ALL adapters (admin only)
// POST   /api/search/index               — Index a single document (admin only)
// POST   /api/search/index/bulk          — Index multiple documents in bulk (admin only)
// POST   /api/search/indexes             — Create or configure an index (admin only)
// DELETE /api/search/index/:indexName/:id — Delete a document from an index (admin only)
// DELETE /api/search/indexes/:indexName  — Delete an entire index (admin only)

'use strict'

const express = require('express')
const router = express.Router()

const { authenticate, requireAdmin } = require('../../../lib/@system/Helpers/auth')
const Search = require('../../../lib/@system/SearchAdapter')
const { ValidationError } = require('../../../lib/@system/Errors')
const logger = require('../../../lib/@system/Logger')
const { validate } = require('../../../lib/@system/Validation')
const {
  SearchIndexParams,
  SearchDocumentParams,
  CreateIndexBody,
  IndexDocumentBody,
  BulkIndexBody,
} = require('../../../lib/@system/Validation/schemas/@system/search')

// ── GET /api/search ───────────────────────────────────────────────────────────
// Query params:
//   index    (required) — index / index name to search
//   q        (required) — search query
//   filters  (optional) — provider-specific filter string
//   sort     (optional) — comma-separated sort rules, e.g. "price:asc,name:desc"
//   limit    (optional) — max hits (default 20, max 100)
//   offset   (optional) — pagination offset (default 0)
//   fields   (optional) — comma-separated list of fields to retrieve

router.get('/search', authenticate, async (req, res, next) => {
  try {
    const { index, q, filters, sort, limit, offset, fields } = req.query

    if (!index || typeof index !== 'string') {
      throw new ValidationError('index query param is required')
    }
    if (q === undefined || q === null) {
      throw new ValidationError('q query param is required')
    }

    const parsedLimit  = Math.min(parseInt(limit ?? '20', 10) || 20, 100)
    const parsedOffset = Math.max(parseInt(offset ?? '0', 10) || 0, 0)

    // Validate sort rules: each must be "fieldname:asc" or "fieldname:desc" (SEC-1502)
    const SORT_RULE_RE = /^[\w.]+:(asc|desc)$/i
    const rawSortRules = sort ? sort.split(',').map((s) => s.trim()).filter(Boolean) : []
    const invalidSort  = rawSortRules.find((r) => !SORT_RULE_RE.test(r))
    if (invalidSort) throw new ValidationError(`Invalid sort rule: "${invalidSort}". Expected "field:asc" or "field:desc".`)
    const sortRules = rawSortRules.length ? rawSortRules : undefined

    // Validate filter string: length-cap and reject null bytes / obvious injection patterns (SEC-1502)
    if (filters && filters.length > 1024) throw new ValidationError('filters param exceeds 1024 character limit')
    if (filters && /\x00/.test(filters)) throw new ValidationError('filters param contains invalid characters')
    const safeFilters = filters ? String(filters) : undefined

    const attrs = fields ? fields.split(',').map((f) => f.trim()).filter(Boolean) : undefined

    const result = await Search.search({
      index: index.trim(),
      query: String(q),
      filters: safeFilters,
      sort:    sortRules,
      limit:   parsedLimit,
      offset:  parsedOffset,
      attributesToRetrieve: attrs,
    })

    logger.info(
      { index, q, provider: Search.provider, total: result.total, userId: req.user?.id },
      '[search] query executed'
    )

    res.json({ ok: true, provider: Search.provider, ...result })
  } catch (err) {
    next(err)
  }
})

// ── GET /api/search/health ────────────────────────────────────────────────────

router.get('/search/health', authenticate, requireAdmin, (req, res, next) => {
  try {
    res.json({ ok: true, ...Search.health() })
  } catch (err) {
    next(err)
  }
})

// ── GET /api/search/health/all ────────────────────────────────────────────────

router.get('/search/health/all', authenticate, requireAdmin, (req, res, next) => {
  try {
    res.json({ ok: true, adapters: Search.healthAll() })
  } catch (err) {
    next(err)
  }
})

// ── POST /api/search/indexes ──────────────────────────────────────────────────
// Body: { uid, primaryKey?, searchableAttributes?, attributesForFaceting? }

router.post('/search/indexes', authenticate, requireAdmin, validate({ body: CreateIndexBody }), async (req, res, next) => {
  try {
    const { uid, primaryKey, searchableAttributes, attributesForFaceting } = req.body

    if (!uid || typeof uid !== 'string') {
      throw new ValidationError('uid is required')
    }

    const result = await Search.createIndex(uid.trim(), { primaryKey, searchableAttributes, attributesForFaceting })

    logger.info({ uid, provider: Search.provider }, '[search] index created/configured')
    res.status(201).json({ ok: true, uid, ...result })
  } catch (err) {
    next(err)
  }
})

// ── POST /api/search/index ────────────────────────────────────────────────────
// Body: { index, id, document }

router.post('/search/index', authenticate, requireAdmin, validate({ body: IndexDocumentBody }), async (req, res, next) => {
  try {
    const { index, id, document } = req.body

    if (!index || typeof index !== 'string') {
      throw new ValidationError('index is required')
    }
    if (id === undefined || id === null) {
      throw new ValidationError('id is required')
    }
    if (!document || typeof document !== 'object' || Array.isArray(document)) {
      throw new ValidationError('document must be a non-null object')
    }

    const result = await Search.indexDocument({ index: index.trim(), id, document })

    logger.info({ index, id, provider: Search.provider, userId: req.user?.id }, '[search] document indexed')
    res.status(201).json({ ok: true, ...result })
  } catch (err) {
    next(err)
  }
})

// ── POST /api/search/index/bulk ───────────────────────────────────────────────
// Body: { index, documents }

router.post('/search/index/bulk', authenticate, requireAdmin, validate({ body: BulkIndexBody }), async (req, res, next) => {
  try {
    const { index, documents } = req.body

    if (!index || typeof index !== 'string') {
      throw new ValidationError('index is required')
    }
    if (!Array.isArray(documents) || documents.length === 0) {
      throw new ValidationError('documents must be a non-empty array')
    }
    if (documents.length > 1000) {
      throw new ValidationError('Maximum 1000 documents per bulk request')
    }

    const result = await Search.indexDocuments({ index: index.trim(), documents })

    logger.info(
      { index, count: documents.length, provider: Search.provider, userId: req.user?.id },
      '[search] bulk documents indexed'
    )
    res.status(201).json({ ok: true, indexed: documents.length, ...result })
  } catch (err) {
    next(err)
  }
})

// ── DELETE /api/search/index/:indexName/:id ───────────────────────────────────
// Delete a specific document from an index

router.delete('/search/index/:indexName/:id', authenticate, requireAdmin, validate({ params: SearchDocumentParams }), async (req, res, next) => {
  try {
    const { indexName, id } = req.params

    const result = await Search.deleteDocument({ index: indexName, id })

    logger.info({ index: indexName, id, provider: Search.provider, userId: req.user?.id }, '[search] document deleted')
    res.json({ ok: true, deleted: true, ...result })
  } catch (err) {
    next(err)
  }
})

// ── DELETE /api/search/indexes/:indexName ─────────────────────────────────────
// Delete an entire index

router.delete('/search/indexes/:indexName', authenticate, requireAdmin, validate({ params: SearchIndexParams }), async (req, res, next) => {
  try {
    const { indexName } = req.params

    const result = await Search.deleteIndex(indexName)

    logger.info({ index: indexName, provider: Search.provider, userId: req.user?.id }, '[search] index deleted')
    res.json({ ok: true, deleted: true, ...result })
  } catch (err) {
    next(err)
  }
})

module.exports = router
