// @system — server entrypoint
// Boot order: (optional) in-process migrations → env validation → DB/Redis
// connect (non-fatal, bounded retry) → HTTP listen → graceful shutdown wiring.
//
// Migrations: start.sh already runs `npm run migrate` before this file and sets
// SKIP_STARTUP_MIGRATIONS=1, so the in-process run below is a fallback for
// environments that launch `node src/index.js` directly. It runs at most once,
// is never fatal, and never drops/rewrites the schema_migrations table.

require('dotenv').config()

// ── Optional in-process DB migrations (non-fatal) ─────────────────────────
;(function runStartupMigrations() {
  const log = (msg) => console.log(`[startup][${new Date().toISOString()}] ${msg}`)
  const skip = process.env.SKIP_STARTUP_MIGRATIONS
  if (skip === '1' || skip === 'true') {
    log('SKIP_STARTUP_MIGRATIONS set — assuming migrations already ran (start.sh).')
    return
  }
  const { execFileSync } = require('child_process')
  const path = require('path')
  const runJs = path.join(__dirname, 'db/migrations/@system/run.js')
  try {
    log('Running DB migrations (set SKIP_STARTUP_MIGRATIONS=1 to skip)...')
    execFileSync(process.execPath, [runJs], { stdio: 'inherit', env: process.env })
    log('Migrations done.')
  } catch (e) {
    // Never attempt destructive "recovery" here: a failed migration is a
    // signal for an operator, not something to paper over by dropping tables.
    log(`WARNING: migrations failed (${e.message}). Server will start anyway — `
      + 'run `npm run migrate:status` and fix the failing migration manually.')
  }
})()

require('./lib/@system/Env') // validate env vars — exits with a clear error if required vars are missing
require('./lib/@custom/Env') // product-specific env validation — fail fast on missing required vars (#276526)

// Storage provider must be durable in production (STORAGE_PROVIDER=local is
// refused unless ALLOW_EPHEMERAL_STORAGE=1) — abort now, not on the first upload.
try {
  require('./lib/@system/StorageAdapter').assertProductionSafe()
} catch (err) {
  console.error(`\n[Storage] Startup aborted — ${err.message}\n`)
  process.exit(1)
}

const http = require('http')
const app = require('./app')
const logger = require('./lib/@system/Logger')
const ErrorTracking = require('./lib/@system/ErrorTracking')
const { connect: connectRedis } = require('./lib/@system/Redis')
const { connectPool: connectPostgres, disconnectPool: disconnectPostgres } = require('./lib/@system/PostgreSQL')
const { scheduler } = require('./scheduler/tasks/@system')

// Default (3000) and type check live in lib/@system/Env — single source of truth.
const PORT = Number(process.env.PORT)
// In production (App Runner / Docker), bind to 0.0.0.0 so the platform can route traffic.
// In development, bind to localhost only to prevent external access.
const BIND_HOST = process.env.BIND_HOST ||
  (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1')

/** Hard deadline for graceful shutdown before we force-exit. */
const SHUTDOWN_TIMEOUT_MS = parseInt(process.env.SHUTDOWN_TIMEOUT_MS ?? '10000', 10)

async function start() {
  // Initialize error tracking early so it captures startup errors
  ErrorTracking.init()

  // DB + Redis connections are non-fatal — server starts in degraded mode if
  // either is unreachable.  The /api/health endpoint reports the actual state.
  // CRITICAL: if connectPostgres() throws here the HTTP server never starts,
  // the platform health check times out, and the deployment rolls back — leaving
  // the old (broken) build running forever.  (#31020)
  // connectPostgres() retries with backoff internally (see PostgreSQL/index.js).
  try { await connectPostgres() } catch (err) {
    logger.warn({ err: err.message }, 'PostgreSQL unavailable at startup — running degraded')
  }
  try { await connectRedis() } catch (err) {
    logger.warn({ err: err.message }, 'Redis unavailable at startup — running degraded')
  }

  // ── Email logging ──────────────────────────────────────────────────────
  // Register email tracking callback if EmailLogRepo exists
  try {
    const Email = require('./lib/@system/Email')
    const EmailLogRepo = require('./db/repos/@custom/EmailLogRepo')
    Email.setEmailSentCallback((data) => EmailLogRepo.create(data))
    logger.info('email logging enabled')
  } catch (_) {
    // EmailLogRepo not available — email logging disabled
  }

  // ── Scheduler ──────────────────────────────────────────────────────────
  // Template-owned tasks first (contact retention purge…), then product tasks.
  try {
    const initSystemTasks = require('./scheduler/tasks/@system/init')
    initSystemTasks(scheduler)
    logger.info('system tasks initialised')
  } catch (err) {
    logger.warn({ err }, 'system task init failed — skipping')
  }

  // Initialize custom tasks (application layer imports @custom, not @system)
  try {
    const initCustomTasks = require('./scheduler/tasks/@custom/init')
    initCustomTasks(scheduler)
    logger.info('custom tasks initialised')
  } catch (err) {
    logger.warn({ err }, 'no custom task init found or init failed — skipping')
  }

  // ── Create HTTP server (required for GraphQL WebSocket subscriptions) ──
  const httpServer = http.createServer(app)

  // ── GraphQL setup ──────────────────────────────────────────────────────
  try {
    const { setupGraphQL } = require('./graphql/@system')
    await setupGraphQL(app, httpServer)
    logger.info('GraphQL API initialized')
  } catch (err) {
    logger.warn({ err: err.message }, 'GraphQL setup failed — continuing without GraphQL')
  }

  httpServer.listen(PORT, BIND_HOST, () => {
    logger.info({ port: PORT, host: BIND_HOST, env: process.env.NODE_ENV ?? 'development' }, 'server started')
  })

  // ── Graceful shutdown ──────────────────────────────────────────────────
  // Idempotent: the first caller wins; later signals/crashes only log. A hard
  // timer force-exits if connections refuse to drain within SHUTDOWN_TIMEOUT_MS.
  let shuttingDown = false

  function shutdown(signal, exitCode = 0) {
    if (shuttingDown) {
      logger.warn({ signal }, 'shutdown already in progress — ignoring')
      return
    }
    shuttingDown = true
    logger.info({ signal, exitCode }, 'shutdown signal received')

    const forceTimer = setTimeout(() => {
      logger.error({ signal, timeoutMs: SHUTDOWN_TIMEOUT_MS }, 'shutdown timed out — forcing exit')
      process.exit(exitCode || 1)
    }, SHUTDOWN_TIMEOUT_MS)
    forceTimer.unref()

    httpServer.close(async () => {
      try {
        await ErrorTracking.flush()
        await disconnectPostgres()
        logger.info('shutdown complete')
      } catch (err) {
        logger.error({ err }, 'error during shutdown')
      } finally {
        clearTimeout(forceTimer)
        process.exit(exitCode)
      }
    })
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  // ── Crash safety — log + shutdown on unhandled errors (#37327) ───────
  process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason))
    logger.fatal({ err }, 'unhandled promise rejection — shutting down')
    ErrorTracking.captureError(err, { level: 'fatal' })
    shutdown('unhandledRejection', 1)
  })

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaught exception — shutting down')
    ErrorTracking.captureError(err, { level: 'fatal' })
    shutdown('uncaughtException', 1)
  })
}

start()
