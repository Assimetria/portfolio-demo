// @system — request id middleware
// Reuses a well-formed incoming X-Request-Id (set by the load balancer /
// CloudFront / nginx) or mints a UUID. The id is exposed as req.id, echoed in
// the X-Request-Id response header, used by pino-http as the log request id
// and returned in error JSON so users can quote it to support.

const { randomUUID } = require('crypto')

const HEADER = 'X-Request-Id'
// Only accept ids that are safe to log and echo (no CR/LF, bounded length).
const SAFE_ID = /^[A-Za-z0-9._:-]{1,128}$/

function resolveRequestId(req) {
  const incoming = req.headers?.['x-request-id']
  if (typeof incoming === 'string' && SAFE_ID.test(incoming)) return incoming
  return randomUUID()
}

function requestId(req, res, next) {
  const id = resolveRequestId(req)
  req.id = id
  res.setHeader(HEADER, id)
  next()
}

module.exports = requestId
module.exports.resolveRequestId = resolveRequestId
module.exports.HEADER = HEADER
