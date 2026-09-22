// @custom — Research: Caching strategies for the dashboard API endpoint (SV4-100)
//
// === OVERVIEW ===
// This module documents the research and analysis of caching strategies
// applicable to the dashboard (/api/dashboard) endpoint and its data.
// The dashboard is a high-traffic, authenticated endpoint that aggregates
// user-specific data (stats, activity, usage). The research compares six
// caching strategies across criteria relevant to this use case.
//
// Each strategy is evaluated against:
//   - Freshness: How recent is the data the user sees?
//   - Implementation complexity: Lines of code, dependencies, maintenance.
//   - Infrastructure cost: Memory, Redis instance, CDN, etc.
//   - Cache invalidation: How/when stale entries are purged.
//   - User isolation: Per-user vs shared cache keys.
//
// Usage:
//   const { strategies, recommend } = require("./caching-research")

'use strict'

/**
 * @typedef {Object} CachingStrategy
 * @property {string} id
 * @property {string} name
 * @property {string} category  "client" | "server" | "infra"
 * @property {string} description
 * @property {string[]} pros
 * @property {string[]} cons
 * @property {number} freshness     Rating 1-5 (higher = fresher)
 * @property {number} complexity    Rating 1-5 (higher = more complex)
 * @property {number} infraCost     Rating 1-5 (higher = more expensive)
 * @property {boolean} requiresRedis
 * @property {string} useCase
 */

/** @type {CachingStrategy[]} */
const strategies = [
  // ── 1. In-Memory Server Cache (NodeCache / Map) ────────────────────────
  {
    id: 'in-memory',
    name: 'In-Memory Server Cache',
    category: 'server',
    description:
      'Store dashboard JSON responses in a process-level Map or NodeCache ' +
      'with a fixed TTL (e.g. 60 s). Subsequent requests served from memory ' +
      'without touching the database. Cleared on server restart.',
    pros: [
      'Zero infrastructure \u2014 uses existing process memory',
      'Sub-millisecond reads',
      'Trivial to implement (NodeCache already exists at lib/@system/NodeCache)',
      'No network hop',
    ],
    cons: [
      'Cache is lost on restart / redeploy',
      'Not shared across multiple server processes (horizontal scaling)',
      'Memory grows with number of active users',
      'No built-in invalidation per-user \u2014 must use composite keys',
    ],
    freshness: 3,
    complexity: 1,
    infraCost: 1,
    requiresRedis: false,
    useCase: 'Single-process deployments, low-to-medium concurrency (< 500 users)',
  },

  // ── 2. Redis Cache (Shared, Distributed) ──────────────────────────────
  {
    id: 'redis-cache',
    name: 'Redis Cache',
    category: 'infra',
    description:
      'Store serialised dashboard responses in Redis keyed by user ID. ' +
      'TTL-based expiry; optionally invalidate specific keys on data mutations. ' +
      'All server instances share the same cache pool.',
    pros: [
      'Survives server restarts',
      'Shared across all instances \u2014 consistent cache when scaling horizontally',
      'Supports TTL, LRU eviction, atomic operations for invalidation',
      'Can cache rate-limit data, session blacklists, and queues on the same instance',
    ],
    cons: [
      'Requires a running Redis instance \u2014 operational burden',
      'Network round-trip (~1 ms) adds latency vs in-process memory',
      'Cache stampede risk on cold-start for popular users',
      'Extra cost for Redis hosting',
    ],
    freshness: 3,
    complexity: 3,
    infraCost: 3,
    requiresRedis: true,
    useCase: 'Multi-process / auto-scaled deployments; high concurrency (> 500 users)',
  },

  // ── 3. HTTP Cache-Control (CDN / Browser) ─────────────────────────────
  {
    id: 'http-cache',
    name: 'HTTP Cache-Control / CDN Caching',
    category: 'infra',
    description:
      'Leverage Cache-Control headers to allow CDN (CloudFront, App Runner) ' +
      'or the browser to cache dashboard responses. Because the dashboard ' +
      'contains per-user data, private caching (s-maxage=0, max-age=60) or ' +
      'no-cache must be used \u2014 shared caches must never serve user A data to user B.',
    pros: [
      'Offloads requests from the server entirely (CDN edge caching)',
      'Zero code changes to business logic if used as hop-by-hop only',
    ],
    cons: [
      'Per-user private data must NOT be cached in shared CDN \u2014 defeats purpose',
      'Browser caching only helps same-user back-navigation, not concurrent users',
      'Cache invalidation is hard (CDN purge takes seconds to propagate)',
      'Not suitable for dynamic, user-specific dashboard data',
    ],
    freshness: 2,
    complexity: 1,
    infraCost: 1,
    requiresRedis: false,
    useCase: 'Semi-static dashboard sections (e.g. list of available plans, feature flags)',
  },

  // ── 4. Stale-While-Revalidate (SWR) \u2014 Server-Side ─────────────────────
  {
    id: 'swr-server',
    name: 'Stale-While-Revalidate (Server-Side)',
    category: 'server',
    description:
      'Serve cached data immediately (stale), then asynchronously re-fetch ' +
      'from the database and update the cache. The next request gets fresh data. ' +
      'Avoids blocking the response on the database query.',
    pros: [
      'Lowest latency for the user \u2014 cache hit serves instantly',
      'Database gets only one revalidation query per cache key per TTL window',
      'Graceful degradation: stale data is better than a 503 or timeout',
    ],
    cons: [
      'Users may see slightly out-of-date data on the first visit after TTL expires',
      'Requires a background-job mechanism (setTimeout, worker_threads, or job queue)',
      'Race condition: multiple revalidations can start simultaneously without a lock',
      'More complex than simple TTL caching',
    ],
    freshness: 4,
    complexity: 4,
    infraCost: 2,
    requiresRedis: false,
    useCase:
      'Dashboard pages where absolute freshness is not critical ' +
      '(stats aggregated over hours, trend charts)',
  },

  // ── 5. Client-Side SWR / TanStack Query ─────────────────────────────
  {
    id: 'swr-client',
    name: 'Client-Side Stale-While-Revalidate (SWR / TanStack Query)',
    category: 'client',
    description:
      'The client (React hook) fetches the dashboard API, caches the response ' +
      'in memory, and immediately renders cached data on subsequent visits. ' +
      'While the user views stale data, the hook re-fetches in the background ' +
      'and updates the UI when fresh data arrives.',
    pros: [
      'Instant page transitions \u2014 no loading spinner on repeat visits',
      'Deduplicates concurrent requests for the same resource',
      'Auto-refresh on window refocus (user returns to tab)',
      'Well-documented libraries (useSWR, TanStack Query) with small bundle size',
      'No server changes needed \u2014 works with existing /api/dashboard',
    ],
    cons: [
      'Cache is per-browser-tab, lost on hard refresh',
      'First visit always shows a loading state',
      'No benefit for server-rendered or crawler views',
      'Adds ~4\u201312 KB to the client bundle',
    ],
    freshness: 4,
    complexity: 2,
    infraCost: 1,
    requiresRedis: false,
    useCase:
      'SPA dashboard where users navigate between pages frequently; ' +
      'best combined with a server cache to reduce API load',
  },

  // ── 6. Database Materialised Views / Query Memoization ────────────────
  {
    id: 'db-cache',
    name: 'Database Materialised Views / Query Memoization',
    category: 'server',
    description:
      'Pre-compute dashboard aggregates (counts, sums, trends) via PostgreSQL ' +
      'materialised views or a scheduled batch job. The API reads pre-computed ' +
      'rows instead of running expensive aggregation queries at request time.',
    pros: [
      'Eliminates expensive aggregation queries from the request path',
      'Database handles the computation \u2014 no application-level cache invalidation',
      'Ideal for multi-tenant dashboards where each tenant sees aggregated stats',
      'Survives restarts (persisted in PostgreSQL)',
    ],
    cons: [
      'Stale until the next REFRESH MATERIALIZED VIEW',
      'Not suitable for per-user ad-hoc data',
      'Adds schema migration + cron job maintenance',
      'Refresh can be I/O intensive on large datasets',
    ],
    freshness: 2,
    complexity: 4,
    infraCost: 1,
    requiresRedis: false,
    useCase:
      'Global / tenant-level aggregate stats (total users, revenue, ' +
      'requests per day) that change infrequently',
  },
]

/**
 * Determine and recommend the best caching strategies for the dashboard.
 *
 * Returns an object with:
 *   - primary: the best general-purpose strategy given the current codebase
 *   - secondary: a complementary strategy that pairs well with the primary
 *   - fallback: a zero-dependency option when no infra is available
 *
 * @param {{ hasRedis?: boolean, isMultiProcess?: boolean }} [env]
 * @returns {{ primary: CachingStrategy, secondary: CachingStrategy, fallback: CachingStrategy }}
 */
function recommend(env) {
  env = env || {}
  const hasRedis = 'hasRedis' in env ? env.hasRedis : Boolean(process.env.REDIS_URL)
  const likelyMultiProc = 'isMultiProcess' in env ? env.isMultiProcess : process.env.NODE_ENV === 'production'

  // Helper to find a strategy by ID
  const byId = (id) => strategies.find((s) => s.id === id)

  if (hasRedis && likelyMultiProc) {
    return {
      primary: byId('redis-cache'),
      secondary: byId('swr-client'),
      fallback: byId('in-memory'),
    }
  }

  if (!hasRedis && likelyMultiProc) {
    return {
      primary: byId('swr-client'),
      secondary: byId('http-cache'),
      fallback: byId('in-memory'),
    }
  }

  // Single-process (development, small deployments)
  return {
    primary: byId('in-memory'),
    secondary: byId('swr-client'),
    fallback: byId('swr-server'),
  }
}

// ─── Exports ────────────────────────────────────────────────────────────────────

module.exports = {
  strategies,
  recommend,
}
