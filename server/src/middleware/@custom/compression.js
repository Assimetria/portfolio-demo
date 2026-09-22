// @custom — Content-type aware response compression middleware (SV3-034)
//
// Wraps the `compression` package with a custom filter that only compresses
// text-based / structured content types where gzip/deflate yields meaningful
// savings.  Already-compressed binary formats (JPEG, PNG, MP4, zip, etc.) are
// skipped to avoid wasting CPU on data that cannot be further compressed.
//
// Usage in app.js:
//   const compressionMiddleware = require('./middleware/@custom/compression')
//   app.use(compressionMiddleware)

const compression = require('compression')

// Text / structured MIME types that benefit from compression.
const COMPRESSIBLE_TYPES = [
  'text/html',
  'text/css',
  'text/plain',
  'text/xml',
  'text/javascript',
  'application/json',
  'application/javascript',
  'application/xml',
  'application/xhtml+xml',
  'application/rss+xml',
  'application/atom+xml',
  'application/ld+json',
  'application/manifest+json',
  'application/vnd.api+json',
  'image/svg+xml',
]

/**
 * Determine whether the response should be compressed based on its
 * Content-Type header.  Returns `true` for text-based types listed above,
 * `false` for everything else (binary images, video, already-compressed
 * archives, etc.).  When no Content-Type is set yet the default behaviour
 * of the `compression` module's built-in `compressible` check is used as
 * a fallback.
 */
function contentTypeFilter(req, res) {
  const type = res.getHeader('Content-Type')

  // No header set yet — fall back to the library's built-in compressible
  // database so we don't accidentally suppress compression for responses that
  // simply haven't had their type set at filter-time.
  if (!type) {
    return compression.filter(req, res)
  }

  const normalized = String(type).toLowerCase()

  if (COMPRESSIBLE_TYPES.some((ct) => normalized.includes(ct))) {
    return true
  }

  // Everything else (image/png, video/mp4, application/zip …) is skipped.
  return false
}

const compressionMiddleware = compression({
  // Only compress responses larger than 1 KB — tiny payloads do not benefit
  // from compression and the overhead of the Content-Encoding negotiation can
  // outweigh the savings.
  threshold: 1024,

  // Compression level (zlib 1-9).  6 is the default and provides a good
  // balance between CPU cost and compression ratio for on-the-fly encoding.
  level: 6,

  // Use the custom content-type aware filter defined above.
  filter: contentTypeFilter,
})

// Expose internals for unit testing.
compressionMiddleware.COMPRESSIBLE_TYPES = COMPRESSIBLE_TYPES
compressionMiddleware.contentTypeFilter = contentTypeFilter

module.exports = compressionMiddleware
