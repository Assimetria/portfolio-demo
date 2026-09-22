// @system — PostgreSQL connection (pg-promise)
// module.exports IS the pg-promise db instance used by every repo. Lifecycle
// helpers (connectPool with bounded retry, disconnectPool, isConnected) are
// attached as extra properties. Connection URL resolution and SSL policy are
// documented inline below.

// Require logger first so it's available in pg-promise callbacks
const logger = require('../Logger')

const pgp = require('pg-promise')({
  /**
   * Called when a new client is acquired from the pool.
   * `useCount` is 0 on first checkout, increments on reuse.
   */
  connect({ client, useCount }) {
    if (useCount === 0) {
      logger.debug({ host: client.host, database: client.database }, 'PostgreSQL client connected')
    }
  },

  /**
   * Called when a client is returned to the pool.
   */
  disconnect({ client }) {
    logger.debug({ host: client.host, database: client.database }, 'PostgreSQL client released')
  },

  /**
   * Called on any pg-promise query error.
   */
  error(err, e) {
    logger.error({ err, query: e?.query }, 'PostgreSQL error')
  },
})

// ── Pool configuration ─────────────────────────────────────────────────────

// Resolve the connection URL.
//
// Priority on Railway (#18836 regression fix):
//   1. PG* vars — Railway injects these alongside the Postgres plugin and keeps
//      them in sync with the actual database credentials. DATABASE_URL can become
//      stale if manually overridden or after a credential rotation, so on Railway
//      we always prefer the authoritative individual vars.
//   2. DATABASE_URL — used outside Railway (local dev, other hosting).
//   3. Fallback — hardcoded localhost for local dev without any env config.
//
// Background: #18584 added PG* fallback only when DATABASE_URL was absent.
// This did not fix the regression because Railway's DATABASE_URL was SET but
// contained stale/wrong credentials, so the early-return on line 1 bypassed
// the correct PG* vars entirely. (#18836)
// Tracks which resolution path was used — exposed via health endpoint so
// operators can instantly see why the DB is disconnected (#31258).
let _dbSource = 'localhost_default'

function resolveDbUrl() {
  const { PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE } = process.env
  const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT)

  // On Railway: always build from PG* vars (authoritative, auto-rotated by Railway)
  if (isRailway && PGHOST && PGUSER && PGDATABASE) {
    const port = PGPORT ?? '5432'
    const pass = PGPASSWORD ? `:${encodeURIComponent(PGPASSWORD)}` : ''
    logger.info(
      { host: PGHOST, port, user: PGUSER, database: PGDATABASE },
      'Railway detected — DB URL built from PGHOST/PGUSER/PGDATABASE (overrides DATABASE_URL) (#18836)',
    )
    _dbSource = 'railway_pg_vars'
    return `postgresql://${PGUSER}${pass}@${PGHOST}:${port}/${PGDATABASE}`
  }

  // On Railway WITHOUT PG* vars: the PostgreSQL plugin is not attached (#31258)
  if (isRailway && !PGHOST) {
    logger.error(
      'Railway detected but PGHOST is not set — no PostgreSQL plugin attached to this project. '
      + 'Add one at railway.app → Project → + New → Database → PostgreSQL (#31258)',
    )
  }

  // Outside Railway: honour DATABASE_URL if set
  if (process.env.DATABASE_URL) {
    _dbSource = 'database_url'
    return process.env.DATABASE_URL
  }

  // Non-Railway fallback: build from PG* vars (#18584)
  if (PGHOST && PGUSER && PGDATABASE) {
    const port = PGPORT ?? '5432'
    const pass = PGPASSWORD ? `:${encodeURIComponent(PGPASSWORD)}` : ''
    logger.warn(
      { host: PGHOST, port, user: PGUSER, database: PGDATABASE },
      'DATABASE_URL not set — built from PGHOST/PGUSER/PGDATABASE (#18584)',
    )
    _dbSource = 'pg_vars_fallback'
    return `postgresql://${PGUSER}${pass}@${PGHOST}:${port}/${PGDATABASE}`
  }

  _dbSource = 'localhost_default'
  return 'postgresql://postgres:postgres@localhost:5432/product_template_dev'
}

const DB_URL = resolveDbUrl()
const POOL_MAX = parseInt(process.env.DB_POOL_MAX ?? '10', 10)
const POOL_IDLE_TIMEOUT = parseInt(process.env.DB_POOL_IDLE_TIMEOUT ?? '30000', 10)
const POOL_CONNECTION_TIMEOUT = parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT ?? '10000', 10)

const connectionConfig = {
  connectionString: DB_URL,

  // Maximum number of clients in the pool.
  // Tune based on expected concurrency and your DB server's max_connections.
  max: POOL_MAX,

  // Close idle clients after this many milliseconds.
  idleTimeoutMillis: POOL_IDLE_TIMEOUT,

  // Throw an error if a client cannot be acquired within this period.
  connectionTimeoutMillis: POOL_CONNECTION_TIMEOUT,

  // SSL — depends on where the DB URL came from (#31258):
  //
  // railway_pg_vars: Railway's internal Postgres needs SSL (self-signed certs).
  //   Always enable with rejectUnauthorized=false.
  //
  // database_url on Railway: External DB — may not support SSL at all.
  //   "The server does not support SSL connections" fixed here (#31258).
  //   Default NO SSL; opt-in with DB_POOL_SSL=true or sslmode= in URL.
  //
  // Non-Railway production: SSL on by default; DB_POOL_SSL=false to disable.
  ssl: (() => {
    const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT)

    // Railway with native PG* vars — always SSL (internal Postgres requires it)
    if (isRailway && _dbSource === 'railway_pg_vars') {
      return process.env.DB_SSL_CA
        ? { ca: require('fs').readFileSync(process.env.DB_SSL_CA) }
        : { rejectUnauthorized: false }
    }

    // Explicit opt-out everywhere
    if (process.env.DB_POOL_SSL === 'false') return undefined

    // Railway without PG* vars — DATABASE_URL points to external DB that may
    // not support SSL. Default OFF; enable with DB_POOL_SSL=true (#31258).
    if (isRailway) {
      if (process.env.DB_POOL_SSL === 'true') {
        return { rejectUnauthorized: false }
      }
      return undefined
    }

    // Non-Railway production: SSL on by default
    if (process.env.NODE_ENV === 'production') {
      return process.env.DB_SSL_CA
        ? { ca: require('fs').readFileSync(process.env.DB_SSL_CA) }
        : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
    }
    return undefined
  })(),
}

const db = pgp(connectionConfig)

// ── Lifecycle helpers ──────────────────────────────────────────────────────

// Tracks whether the last connectPool() attempt succeeded. Exposed as
// isConnected() so callers (health endpoint, tests) can read startup state
// without issuing a query.
let _connected = false

/** Startup retry policy — bounded, exponential (1s, 2s, 4s, 8s …). */
const CONNECT_ATTEMPTS = Math.max(1, parseInt(process.env.DB_CONNECT_ATTEMPTS ?? '5', 10))
const CONNECT_BASE_DELAY_MS = parseInt(process.env.DB_CONNECT_BASE_DELAY_MS ?? '1000', 10)
const CONNECT_MAX_DELAY_MS = parseInt(process.env.DB_CONNECT_MAX_DELAY_MS ?? '8000', 10)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Verify the pool can reach the database. Call once at server startup.
 * Retries up to DB_CONNECT_ATTEMPTS times with exponential backoff, then
 * throws the last error. The caller (index.js) treats that as non-fatal and
 * starts in degraded mode; /api/health keeps probing the DB truthfully.
 */
async function connectPool({ attempts = CONNECT_ATTEMPTS } = {}) {
  let lastErr
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await connectOnce()
      _connected = true
      return
    } catch (err) {
      lastErr = err
      _connected = false
      if (attempt < attempts) {
        const delay = Math.min(CONNECT_BASE_DELAY_MS * 2 ** (attempt - 1), CONNECT_MAX_DELAY_MS)
        logger.warn(
          { err: err.message, attempt, attempts, retryInMs: delay, dbSource: _dbSource },
          'PostgreSQL connect failed — retrying',
        )
        await sleep(delay)
      }
    }
  }
  logger.error({ err: lastErr?.message, attempts, dbSource: _dbSource }, 'PostgreSQL connect failed after all attempts')
  throw lastErr
}

/** True when the most recent connectPool() succeeded. */
function isConnected() {
  return _connected
}

async function connectOnce() {
  // Log connection target (password redacted) so Railway DATABASE_URL
  // misconfigurations are immediately visible in startup logs (#18584)
  const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT)
  try {
    const url = new URL(DB_URL)
    logger.info(
      {
        host: url.hostname,
        port: url.port || 5432,
        database: url.pathname.slice(1),
        user: url.username,
        ssl: connectionConfig.ssl ? true : false,
        dbSource: _dbSource,
      },
      'PostgreSQL connecting',
    )
  } catch (_) {
    logger.warn({ databaseUrl: '[unparseable]' }, 'DATABASE_URL could not be parsed — check env var')
  }

  try {
    const conn = await db.connect()
    const { serverVersion } = conn.client
    conn.done() // return the client to the pool immediately
    logger.info(
      { serverVersion, poolMax: POOL_MAX, idleTimeout: POOL_IDLE_TIMEOUT, dbSource: _dbSource },
      'PostgreSQL connected',
    )
  } catch (err) {
    // On Railway with db_source != railway_pg_vars, the most likely cause is
    // a missing PostgreSQL plugin — provide actionable guidance (#31258)
    if (isRailway && _dbSource !== 'railway_pg_vars') {
      logger.error(
        { err: err.message, dbSource: _dbSource },
        'PostgreSQL connection failed on Railway — likely no PostgreSQL plugin attached. '
        + 'Fix: Railway dashboard → Project → + New → Database → PostgreSQL, then redeploy (#31258)',
      )
    }
    throw err
  }
}

/**
 * Drain the pool and close all connections. Call on SIGTERM / SIGINT.
 */
async function disconnectPool() {
  _connected = false
  await pgp.end()
  logger.info('PostgreSQL pool closed')
}

// ── Exports ───────────────────────────────────────────────────────────────
//
// module.exports IS the pg-promise db object — existing repos continue to
// work unchanged: `const db = require('.../PostgreSQL')`.
//
// Lifecycle helpers are attached as extra properties:
//   const { connectPool, disconnectPool } = require('.../PostgreSQL')
//

module.exports = db
module.exports.connectPool = connectPool
module.exports.disconnectPool = disconnectPool
module.exports.isConnected = isConnected
module.exports.pgp = pgp
/** Which resolution path was used to build the DB URL (#31258). */
Object.defineProperty(module.exports, 'dbSource', { get: () => _dbSource })
