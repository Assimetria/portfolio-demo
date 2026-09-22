// @system — final Express error handler
// Logs every error with full detail (stack, code, request id) and returns a
// JSON body `{ message, code?, requestId }`. In production, 5xx responses
// carry a generic message — internal error text (driver messages, file paths,
// stack fragments) is never sent to clients. 4xx messages are passed through
// because they are authored for users (validation, not-found, auth…).

const GENERIC_5XX = 'Something went wrong on our side. Please try again later.'

/** Strip absolute filesystem paths that occasionally leak into messages. */
function redactPaths(message) {
  return String(message).replace(/\/(?:Users|home|app|var|tmp)\/[^\s'"`]*/g, '[path]')
}

function normaliseStatus(err) {
  const raw = err.status ?? err.statusCode ?? 500
  const n = Number(raw)
  return Number.isInteger(n) && n >= 400 && n < 600 ? n : 500
}

/**
 * @param {{ logger: import('pino').Logger, isProd?: boolean }} deps
 */
function createErrorHandler({ logger, isProd = process.env.NODE_ENV === 'production' }) {
  return function errorHandler(err, req, res, _next) {
    const requestId = req.id
    const status = normaliseStatus(err)

    // Explicitly extract non-enumerable Error fields (message, stack, name) so the
    // stack trace is preserved in the log output. Passing a bare `{ err }` relies
    // on the logger having an error serializer configured — without one, pino only
    // captures enumerable properties and the stack is silently dropped.
    logger[status >= 500 ? 'error' : 'warn'](
      {
        requestId,
        err: {
          message: err.message,
          name: err.name,
          stack: err.stack,
          code: err.code,
          type: err.type,
          status,
        },
        req: { method: req.method, url: req.originalUrl ?? req.url, ip: req.ip },
      },
      err.message ?? 'Internal server error',
    )

    if (res.headersSent) return

    const send = (code, body) => res.status(code).json({ ...body, requestId })

    // JSON body parse errors — body-parser sets err.type = 'entity.parse.failed' and err.status = 400.
    // Never leak the raw parser message (it includes position details and Node.js internals).
    if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400 && 'body' in err)) {
      return send(400, { message: 'Invalid JSON in request body', code: 'INVALID_JSON' })
    }

    // Payload too large (body-parser)
    if (err.type === 'entity.too.large') {
      return send(413, { message: 'Request body is too large', code: 'PAYLOAD_TOO_LARGE' })
    }

    // Database connection timeout errors should return 503 Service Unavailable
    if (err.message && (err.message.includes('Connection terminated') || err.message.includes('connection timeout'))) {
      return send(503, { message: 'Database service is temporarily unavailable. Please try again later.', code: 'DB_UNAVAILABLE' })
    }

    // Stripe SDK errors have a `type` field (e.g. StripeCardError, StripeInvalidRequestError).
    // Never expose raw Stripe messages to clients — they contain internal details such as
    // price/customer IDs, live-vs-test mode hints, and API key hints.
    if (typeof err.type === 'string' && err.type.startsWith('Stripe')) {
      const stripeStatus = err.statusCode ?? 400

      // Card errors carry a user-safe decline message (e.g. "Your card has insufficient funds.")
      if (err.type === 'StripeCardError') {
        return send(stripeStatus, { message: err.message ?? 'Your card was declined. Please check your payment details.', code: 'CARD_DECLINED' })
      }
      // Authentication errors mean a misconfigured API key — generic message for users
      if (err.type === 'StripeAuthenticationError') {
        return send(500, { message: 'Payment service is temporarily unavailable. Please try again later.', code: 'PAYMENT_UNAVAILABLE' })
      }
      // Rate limit — tell the user to slow down
      if (err.type === 'StripeRateLimitError') {
        return send(429, { message: 'Too many requests. Please wait a moment and try again.', code: 'RATE_LIMITED' })
      }
      // All other Stripe errors (StripeInvalidRequestError, StripeAPIError, StripeConnectionError, etc.)
      return send(stripeStatus >= 400 && stripeStatus < 600 ? stripeStatus : 400, {
        message: 'Something went wrong with the payment service. Please try again or contact support.',
        code: 'PAYMENT_ERROR',
      })
    }

    const body = {}
    if (status >= 500) {
      // Production: generic copy only. Non-production: keep the real message
      // (paths redacted) so developers see what broke.
      body.message = isProd ? GENERIC_5XX : redactPaths(err.message ?? 'Internal server error')
    } else {
      body.message = redactPaths(err.message ?? 'Request failed')
      // Only forward application-level string codes (e.g. 'EMAIL_TAKEN'), never
      // driver codes like '23505' which describe the schema.
      if (typeof err.code === 'string' && /^[A-Z][A-Z0-9_]{2,63}$/.test(err.code)) body.code = err.code
      if (Array.isArray(err.errors)) body.errors = err.errors
    }
    return send(status, body)
  }
}

module.exports = { createErrorHandler, GENERIC_5XX, redactPaths, normaliseStatus }
