/**
 * Error Tracking System
 *
 * Integrates with Sentry for error monitoring, performance tracking,
 * and user context capture. Falls back gracefully if not configured.
 *
 * Sentry v8 — @sentry/tracing merged into @sentry/node.
 * Express, HTTP, and PostgreSQL are auto-instrumented.
 */

const logger = require('../Logger')

let Sentry = null
let initialized = false

/**
 * Initialize Sentry (call this early in app startup)
 *
 * @param {Object} options - Sentry configuration options
 * @param {string} options.dsn - Sentry DSN (or from process.env.SENTRY_DSN)
 * @param {string} options.environment - Environment name (default: NODE_ENV)
 * @param {number} options.tracesSampleRate - Performance monitoring sample rate (0-1)
 * @param {boolean} options.debug - Enable Sentry debug mode
 */
function init(options = {}) {
  const dsn = options.dsn || process.env.SENTRY_DSN

  if (!dsn) {
    logger.info('[ErrorTracking] Sentry DSN not configured - error tracking disabled')
    return
  }

  try {
    // Lazy load Sentry only if configured
    Sentry = require('@sentry/node')

    Sentry.init({
      dsn,
      environment: options.environment || process.env.NODE_ENV || 'development',
      tracesSampleRate: options.tracesSampleRate ?? (process.env.NODE_ENV === 'production' ? 0.1 : 1.0),
      debug: options.debug ?? false,

      // Release tracking (use Git SHA or version)
      release: process.env.GIT_SHA || process.env.npm_package_version,

      // v8: Express, HTTP, and PostgreSQL integrations are auto-enabled.
      // No explicit integrations needed for standard instrumentation.

      // Don't send errors from development unless explicitly enabled
      enabled: process.env.NODE_ENV !== 'development' || options.debug === true,

      // Filter sensitive data
      beforeSend(event, hint) {
        // Remove sensitive headers
        if (event.request?.headers) {
          delete event.request.headers['authorization']
          delete event.request.headers['cookie']
          delete event.request.headers['x-csrf-token']
        }

        // Remove sensitive cookies
        if (event.request?.cookies) {
          delete event.request.cookies['token']
          delete event.request.cookies['sessionId']
        }

        return event
      },
    })

    initialized = true
    const client = Sentry.getClient()
    logger.info({
      environment: client?.getOptions().environment,
      release: client?.getOptions().release,
    }, '[ErrorTracking] Sentry initialized')
  } catch (err) {
    logger.error({ err }, '[ErrorTracking] Failed to initialize Sentry')
    Sentry = null
  }
}

/**
 * Capture an exception
 *
 * @param {Error} error - Error object to capture
 * @param {Object} context - Additional context
 * @param {Object} context.user - User information
 * @param {Object} context.extra - Extra data to attach
 * @param {Object} context.tags - Tags for filtering
 * @param {string} context.level - Severity level ('fatal', 'error', 'warning', 'info', 'debug')
 * @returns {string|null} Event ID if sent to Sentry
 */
function captureError(error, context = {}) {
  // Always log to standard logger
  logger.error({
    err: error,
    ...context.extra,
  }, `[ErrorTracking] ${error.message}`)

  if (!initialized || !Sentry) {
    return null
  }

  return Sentry.captureException(error, {
    user: context.user,
    extra: context.extra,
    tags: context.tags,
    level: context.level || 'error',
  })
}

/**
 * Capture a message (for non-error events)
 *
 * @param {string} message - Message to capture
 * @param {Object} context - Additional context
 * @param {string} context.level - Severity level (default: 'info')
 * @param {Object} context.extra - Extra data
 * @param {Object} context.tags - Tags
 * @returns {string|null} Event ID if sent to Sentry
 */
function captureMessage(message, context = {}) {
  logger.info({ ...context.extra }, `[ErrorTracking] ${message}`)

  if (!initialized || !Sentry) {
    return null
  }

  return Sentry.captureMessage(message, {
    level: context.level || 'info',
    extra: context.extra,
    tags: context.tags,
  })
}

/**
 * Set user context for error tracking
 *
 * @param {Object} user - User object
 * @param {number|string} user.id - User ID
 * @param {string} user.email - User email
 * @param {string} user.username - Username
 * @param {Object} user.extra - Additional user data
 */
function setUser(user) {
  if (!initialized || !Sentry || !user) {
    return
  }

  Sentry.setUser({
    id: user.id?.toString(),
    email: user.email,
    username: user.username,
    ...user.extra,
  })
}

/**
 * Clear user context (e.g., after logout)
 */
function clearUser() {
  if (!initialized || !Sentry) {
    return
  }

  Sentry.setUser(null)
}

/**
 * Add breadcrumb for context
 *
 * @param {Object} breadcrumb - Breadcrumb data
 * @param {string} breadcrumb.message - Breadcrumb message
 * @param {string} breadcrumb.category - Category (e.g., 'auth', 'database', 'api')
 * @param {string} breadcrumb.level - Severity level
 * @param {Object} breadcrumb.data - Additional data
 */
function addBreadcrumb(breadcrumb) {
  if (!initialized || !Sentry) {
    return
  }

  Sentry.addBreadcrumb({
    message: breadcrumb.message,
    category: breadcrumb.category,
    level: breadcrumb.level || 'info',
    data: breadcrumb.data,
  })
}

/**
 * Express request handler middleware.
 * v8: Express is auto-instrumented — returns a no-op.
 * Kept for backwards compatibility with existing app.use() calls.
 */
function requestHandler() {
  return (req, res, next) => next()
}

/**
 * Express error handler middleware.
 * v8: Sentry.Handlers removed. Uses setupExpressErrorHandler if available,
 * otherwise captures exceptions manually.
 */
function errorHandler() {
  if (!initialized || !Sentry) {
    return (err, req, res, next) => next(err)
  }

  return (err, req, res, next) => {
    Sentry.captureException(err)
    next(err)
  }
}

/**
 * Express tracing handler middleware.
 * v8: Express is auto-instrumented — returns a no-op.
 * Kept for backwards compatibility with existing app.use() calls.
 */
function tracingHandler() {
  return (req, res, next) => next()
}

/**
 * Start a performance span (replaces startTransaction in v8)
 *
 * @param {string} name - Span name
 * @param {string} op - Operation type (e.g., 'http.server', 'db.query')
 * @returns {Object|null} Span object (call .end() when done)
 */
function startTransaction(name, op) {
  if (!initialized || !Sentry) {
    return null
  }

  return Sentry.startInactiveSpan({ name, op })
}

/**
 * Create a child span for performance tracking
 *
 * @param {Object} _parentSpan - Ignored in v8 (parent resolved via async context)
 * @param {string} op - Operation name
 * @param {string} description - Description / span name
 * @returns {Object|null} Span object (call .end() when done)
 */
function startSpan(_parentSpan, op, description) {
  if (!initialized || !Sentry) {
    return null
  }

  return Sentry.startInactiveSpan({ op, name: description })
}

/**
 * Flush pending events (useful before shutdown)
 *
 * @param {number} timeout - Timeout in milliseconds (default: 2000)
 * @returns {Promise<boolean>} True if successful
 */
async function flush(timeout = 2000) {
  if (!initialized || !Sentry) {
    return true
  }

  try {
    await Sentry.flush(timeout)
    return true
  } catch (err) {
    logger.error({ err }, '[ErrorTracking] Failed to flush Sentry events')
    return false
  }
}

/**
 * Get Sentry instance (for advanced usage)
 * @returns {Object|null} Sentry instance or null if not initialized
 */
function getSentry() {
  return Sentry
}

/**
 * Check if error tracking is enabled
 * @returns {boolean}
 */
function isEnabled() {
  return initialized && Sentry !== null
}

module.exports = {
  init,
  captureError,
  captureMessage,
  setUser,
  clearUser,
  addBreadcrumb,
  requestHandler,
  errorHandler,
  tracingHandler,
  startTransaction,
  startSpan,
  flush,
  getSentry,
  isEnabled,
}
