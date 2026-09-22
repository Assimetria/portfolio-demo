// @custom — search testing guide endpoints
// Provides endpoints for testing and validating search functionality
// across all configured search adapters (Meilisearch / Algolia / none).
//
// GET    /api/search-test           — Get adapter status and test config info
// POST   /api/search-test/run       — Execute a test search with specified params

'use strict'

const express = require('express')
const router = express.Router()
const { authenticate } = require('../../lib/@system/Helpers/auth')
const Search = require('../../lib/@system/SearchAdapter')
const { ValidationError } = require('../../lib/@system/Errors')
const logger = require('../../lib/@system/Logger')

// ── Sample test data ─────────────────────────────────────────────────────────
// Built-in sample documents used for testing search functionality when
// no external search provider is configured (null adapter).
const SAMPLE_DOCUMENTS = [
  { id: 1, title: 'Getting Started Guide', description: 'Learn how to set up and configure your account', category: 'docs', tags: ['beginner', 'setup'], price: 0 },
  { id: 2, title: 'Advanced Configuration', description: 'Deep dive into configuration options and environment variables', category: 'docs', tags: ['advanced', 'config'], price: 0 },
  { id: 3, title: 'API Reference', description: 'Complete API reference with endpoints, parameters, and examples', category: 'docs', tags: ['api', 'reference'], price: 0 },
  { id: 4, title: 'Authentication Guide', description: 'Overview of authentication methods including JWT, API keys, and OAuth', category: 'guides', tags: ['auth', 'security'], price: 0 },
  { id: 5, title: 'Search Plugin', description: 'Full-text search plugin with Meilisearch and Algolia support', category: 'plugins', tags: ['search', 'meilisearch', 'algolia'], price: 29.99 },
  { id: 6, title: 'Analytics Dashboard', description: 'Real-time analytics dashboard with customizable widgets', category: 'features', tags: ['analytics', 'dashboard'], price: 49.99 },
  { id: 7, title: 'Notification System', description: 'Multi-channel notification system with email, SMS, and push', category: 'features', tags: ['notifications', 'email', 'sms'], price: 19.99 },
  { id: 8, title: 'User Management', description: 'User management with roles, permissions, and teams', category: 'features', tags: ['users', 'roles', 'teams'], price: 0 },
  { id: 9, title: 'Billing and Subscriptions', description: 'Subscription management with Stripe and Polar integration', category: 'features', tags: ['billing', 'stripe', 'subscriptions'], price: 39.99 },
  { id: 10, title: 'Webhook Handler', description: 'Incoming webhook handler with signature verification and retry logic', category: 'plugins', tags: ['webhooks', 'integration'], price: 9.99 },
]

// ── GET /api/search-test ─────────────────────────────────────────────────────
// Returns adapter information, provider status, and sample data for testing.

router.get('/search-test', authenticate, async (req, res, next) => {
  try {
    const health = await Search.health()
    const healthAll = await Search.healthAll()

    res.json({
      ok: true,
      provider: Search.provider,
      health,
      healthAll,
      sampleDocuments: SAMPLE_DOCUMENTS,
      sampleIndexes: ['products', 'docs', 'guides', 'plugins'],
    })
  } catch (err) {
    next(err)
  }
})

// ── POST /api/search-test/run ────────────────────────────────────────────────
// Execute a search test query with the given parameters.
// Body:
//   index   (string)  — Index to search (required)
//   q       (string)  — Search query (required)
//   filters (string)  — Optional filter expression
//   sort    (string)  — Optional comma-separated sort rules
//   limit   (number)  — Max results (default 20, max 100)
//   offset  (number)  — Pagination offset (default 0)
//   fields  (string)  — Comma-separated field list to retrieve

router.post('/search-test/run', authenticate, async (req, res, next) => {
  try {
    const { index, q, filters, sort, limit, offset, fields } = req.body

    if (!index || typeof index !== 'string') {
      throw new ValidationError('index is required')
    }
    if (q === undefined || q === null || q === '') {
      throw new ValidationError('q (query) is required')
    }

    const parsedLimit  = Math.min(parseInt(limit ?? '20', 10) || 20, 100)
    const parsedOffset = Math.max(parseInt(offset ?? '0', 10) || 0, 0)

    // Validate sort rules: each must be "fieldname:asc" or "fieldname:desc"
    const SORT_RULE_RE = /^[\w.]+:(asc|desc)$/i
    const rawSortRules = sort ? sort.split(',').map((s) => s.trim()).filter(Boolean) : []
    const invalidSort  = rawSortRules.find((r) => !SORT_RULE_RE.test(r))
    if (invalidSort) throw new ValidationError(`Invalid sort rule: "${invalidSort}". Expected "field:asc" or "field:desc".`)

    // Validate filter string: length-cap and reject null bytes
    if (filters && filters.length > 1024) throw new ValidationError('filters param exceeds 1024 character limit')
    if (filters && /\x00/.test(filters)) throw new ValidationError('filters param contains invalid characters')

    const attrs = fields ? fields.split(',').map((f) => f.trim()).filter(Boolean) : undefined

    const result = await Search.search({
      index: index.trim(),
      query: String(q),
      filters: filters ? String(filters) : undefined,
      sort: rawSortRules.length ? rawSortRules : undefined,
      limit: parsedLimit,
      offset: parsedOffset,
      attributesToRetrieve: attrs,
    })

    logger.info(
      { index, q, provider: Search.provider, total: result.total, userId: req.user?.id },
      '[search-test] test query executed'
    )

    res.json({
      ok: true,
      provider: Search.provider,
      query: { index, q, filters, sort, limit: parsedLimit, offset: parsedOffset, fields },
      result,
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router