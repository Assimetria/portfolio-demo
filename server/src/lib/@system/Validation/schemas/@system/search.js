const { z } = require('zod')

const SearchIndexParams = z.object({
  indexName: z.string().min(1, 'indexName is required').max(100, 'indexName must be at most 100 characters').regex(/^[a-zA-Z0-9_-]+$/, 'indexName must contain only alphanumeric characters, hyphens, and underscores'),
})

const SearchDocumentParams = z.object({
  indexName: z.string().min(1, 'indexName is required').max(100, 'indexName must be at most 100 characters').regex(/^[a-zA-Z0-9_-]+$/, 'indexName must contain only alphanumeric characters, hyphens, and underscores'),
  id: z.string().min(1, 'id is required'),
})

// ── POST bodies ──────────────────────────────────────────────────────────────
// Same index-name rule as the params above; handlers .trim() before use so we trim here too.
const indexName = z.string().trim().min(1, 'index is required').max(100, 'index must be at most 100 characters').regex(/^[a-zA-Z0-9_-]+$/, 'index must contain only alphanumeric characters, hyphens, and underscores')

const CreateIndexBody = z.object({
  uid: indexName,
  primaryKey: z.string().min(1).max(100).optional(),
  searchableAttributes: z.array(z.string().min(1).max(100)).optional(),
  attributesForFaceting: z.array(z.string().min(1).max(100)).optional(),
})

const IndexDocumentBody = z.object({
  index: indexName,
  id: z.union([z.string().min(1, 'id is required'), z.number()], { message: 'id must be a string or number' }),
  document: z.record(z.string(), z.any(), { message: 'document must be a non-null object' }),
})

const BulkIndexBody = z.object({
  index: indexName,
  documents: z.array(z.record(z.string(), z.any()), { message: 'documents must be a non-empty array' })
    .min(1, 'documents must be a non-empty array')
    .max(1000, 'Maximum 1000 documents per bulk request'),
})

module.exports = { SearchIndexParams, SearchDocumentParams, CreateIndexBody, IndexDocumentBody, BulkIndexBody }
