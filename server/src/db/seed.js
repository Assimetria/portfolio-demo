'use strict'

/**
 * Database Seed Script
 *
 * Populates the database with realistic fake data for development and testing.
 *
 * Tables seeded:
 *   - users            (20 users including 1 admin)
 *   - subscriptions    (one per non-admin user, mixed statuses)
 *   - error_events     (50 events across environments/levels)
 *
 * Usage:
 *   node src/db/seed.js              # seed all tables
 *   node src/db/seed.js --clean      # truncate then seed
 *   node src/db/seed.js --users-only # seed users only
 *
 * Note: bcryptjs is used to hash passwords (same as the auth layer).
 */

require('dotenv').config()

const bcrypt = require('bcryptjs')
const db = require('../lib/@system/PostgreSQL')

// ─── Config ───────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 10

// Security: Use env var for seed password, or generate a random one
// NEVER use a weak hardcoded password
const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || (() => {
  const crypto = require('crypto')
  const randomPassword = crypto.randomBytes(16).toString('base64')
  console.warn('[seed] WARNING: No SEED_PASSWORD env var set. Using random password:', randomPassword)
  console.warn('[seed] Set SEED_PASSWORD=your_dev_password to use a consistent password for development.')
  return randomPassword
})()

const args = process.argv.slice(2)
const CLEAN = args.includes('--clean')
const USERS_ONLY = args.includes('--users-only')

// ─── Fake data pools ──────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Alice', 'Bob', 'Carol', 'David', 'Eva', 'Frank', 'Grace', 'Hector',
  'Iris', 'James', 'Kara', 'Leo', 'Mia', 'Noah', 'Olivia', 'Pedro',
  'Quinn', 'Rosa', 'Sam', 'Tina',
]

const LAST_NAMES = [
  'Silva', 'Santos', 'Costa', 'Ferreira', 'Oliveira', 'Pereira', 'Rodrigues',
  'Almeida', 'Nascimento', 'Lima', 'Araújo', 'Fernandes', 'Carvalho',
  'Gomes', 'Martins', 'Rocha', 'Ribeiro', 'Sousa', 'Marques', 'Moreira',
]

const SUBSCRIPTION_STATUSES = ['active', 'active', 'active', 'trialing', 'past_due', 'canceled', 'inactive']

const STRIPE_PRICE_IDS = [
  'price_starter_monthly',
  'price_pro_monthly',
  'price_enterprise_monthly',
  'price_starter_yearly',
  'price_pro_yearly',
]

const ERROR_TITLES = [
  'TypeError: Cannot read properties of undefined',
  'ReferenceError: variable is not defined',
  'SyntaxError: Unexpected token',
  'RangeError: Maximum call stack size exceeded',
  'DatabaseError: connection refused',
  'AuthenticationError: invalid token',
  'ValidationError: email is required',
  'NotFoundError: resource not found',
  'TimeoutError: request timed out after 30s',
  'NetworkError: fetch failed',
  'PermissionError: insufficient privileges',
  'ParseError: JSON parse error at position 42',
]

const ERROR_MESSAGES = [
  "Cannot read properties of undefined (reading 'map')",
  "user is not defined at processPayment (payment.js:47)",
  "Unexpected token '<' at line 1, column 1",
  "Maximum call stack size exceeded in recursive function",
  "connect ECONNREFUSED 127.0.0.1:5432",
  "JsonWebTokenError: invalid signature",
  "ValidationError: 'email' field is required",
  "404 Not Found: /api/users/99999",
  "Request to external API timed out after 30000ms",
  "FetchError: request to https://api.example.com failed",
  "User does not have permission to access this resource",
  "SyntaxError: Unexpected non-whitespace character after JSON",
]

const STACK_TRACES = [
  `Error: Cannot read properties of undefined (reading 'map')
    at UserList.render (/app/client/src/components/UserList.jsx:23:18)
    at processChild (/app/node_modules/react-dom/cjs/react-dom-server.node.development.js:3278:14)
    at resolve (/app/node_modules/react-dom/cjs/react-dom-server.node.development.js:3234:5)
    at ReactDOMServerRenderer.read (/app/node_modules/react-dom/cjs/react-dom-server.node.development.js:3130:11)`,

  `ReferenceError: user is not defined
    at processPayment (/app/server/src/api/payments.js:47:12)
    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)
    at next (/app/node_modules/express/lib/router/route.js:149:13)
    at Route.dispatch (/app/node_modules/express/lib/router/route.js:119:3)`,

  `RangeError: Maximum call stack size exceeded
    at flatten (/app/server/src/lib/utils.js:12:14)
    at flatten (/app/server/src/lib/utils.js:14:20)
    at flatten (/app/server/src/lib/utils.js:14:20)
    at flatten (/app/server/src/lib/utils.js:14:20)`,

  `Error: connect ECONNREFUSED 127.0.0.1:5432
    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1555:16)
    at PostgreSQL.connect (/app/server/src/lib/PostgreSQL/index.js:15:7)
    at Server.start (/app/server/src/index.js:42:18)`,

  `JsonWebTokenError: invalid signature
    at /app/node_modules/jsonwebtoken/verify.js:63:21
    at /app/node_modules/jsonwebtoken/verify.js:51:7
    at authMiddleware (/app/server/src/api/middleware/auth.js:19:5)
    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)`,
]

const PLATFORMS = ['node', 'browser', 'node', 'browser', 'node']
const ENVIRONMENTS = ['production', 'production', 'staging', 'development', 'production']
const LEVELS = ['error', 'error', 'error', 'warning', 'fatal', 'info']
const STATUSES = ['unresolved', 'unresolved', 'unresolved', 'resolved', 'ignored']
const RELEASES = ['1.0.0', '1.0.1', '1.1.0', '1.2.0', '1.2.1', null]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function daysFromNow(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

function makeFingerprint(title) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').slice(0, 64)
}

function log(msg) {
  console.log(`[seed] ${msg}`)
}

// ─── Seeders ──────────────────────────────────────────────────────────────────

async function truncateTables() {
  log('Truncating tables (--clean mode)...')
  await db.none('TRUNCATE error_events, subscriptions, users RESTART IDENTITY CASCADE')
  log('Tables truncated.')
}

async function seedUsers() {
  log('Seeding users...')
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS)

  const users = []

  // Always include one admin user
  users.push({
    email: 'admin@example.com',
    name: 'Admin User',
    password_hash: passwordHash,
    role: 'admin',
    stripe_customer_id: 'cus_admin_000000',
  })

  // 19 regular users
  for (let i = 0; i < 19; i++) {
    const first = FIRST_NAMES[i]
    const last = pick(LAST_NAMES)
    const email = `${first.toLowerCase()}.${last.toLowerCase().replace(/[^a-z]/g, '')}${i > 9 ? i : ''}@example.com`
    users.push({
      email,
      name: `${first} ${last}`,
      password_hash: passwordHash,
      role: 'user',
      stripe_customer_id: `cus_fake_${String(i + 1).padStart(6, '0')}`,
    })
  }

  const inserted = []
  for (const u of users) {
    const row = await db.one(
      `INSERT INTO users (email, name, password_hash, role, stripe_customer_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, email, role`,
      [u.email, u.name, u.password_hash, u.role, u.stripe_customer_id, daysAgo(randInt(30, 180))]
    )
    inserted.push(row)
  }

  log(`Seeded ${inserted.length} users (including 1 admin).`)
  log(`Default password: "${DEFAULT_PASSWORD}"`)
  return inserted
}

async function seedSubscriptions(users) {
  log('Seeding subscriptions...')
  // Skip admin, seed one subscription per regular user
  const regularUsers = users.filter(u => u.role !== 'admin')

  let count = 0
  for (const user of regularUsers) {
    const status = pick(SUBSCRIPTION_STATUSES)
    const priceId = pick(STRIPE_PRICE_IDS)
    const periodStart = daysAgo(randInt(1, 30))
    const periodEnd = daysFromNow(randInt(1, 30))

    await db.none(
      `INSERT INTO subscriptions
         (user_id, stripe_subscription_id, stripe_price_id, status,
          current_period_start, current_period_end, cancel_at_period_end, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING`,
      [
        user.id,
        `sub_fake_${String(user.id).padStart(8, '0')}`,
        priceId,
        status,
        periodStart,
        periodEnd,
        status === 'canceled' ? true : false,
        daysAgo(randInt(30, 180)),
      ]
    )
    count++
  }

  log(`Seeded ${count} subscriptions.`)
}

async function seedErrorEvents(users) {
  log('Seeding error events...')

  const userIds = users.map(u => u.id)
  let count = 0

  for (let i = 0; i < 50; i++) {
    const titleIdx = i % ERROR_TITLES.length
    const title = ERROR_TITLES[titleIdx]
    const message = ERROR_MESSAGES[titleIdx]
    const fingerprint = `${makeFingerprint(title)}_${titleIdx}`
    const level = pick(LEVELS)
    const platform = pick(PLATFORMS)
    const environment = pick(ENVIRONMENTS)
    const release = pick(RELEASES)
    const status = pick(STATUSES)
    const timesSeen = randInt(1, 500)
    const firstSeen = daysAgo(randInt(7, 90))
    const lastSeen = daysAgo(randInt(0, 6))
    const stackTrace = pick(STACK_TRACES)
    const userId = Math.random() > 0.4 ? pick(userIds) : null

    const extra = {
      url: `https://app.example.com/dashboard?page=${randInt(1, 10)}`,
      method: pick(['GET', 'POST', 'PUT', 'DELETE']),
      statusCode: pick([400, 401, 403, 404, 500, 502, 503]),
      userAgent: pick([
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'node-fetch/2.6.7',
      ]),
    }

    await db.none(
      `INSERT INTO error_events
         (fingerprint, title, message, level, platform, environment, release,
          status, times_seen, first_seen, last_seen, stack_trace, extra, user_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        fingerprint,
        title,
        message,
        level,
        platform,
        environment,
        release,
        status,
        timesSeen,
        firstSeen,
        lastSeen,
        stackTrace,
        JSON.stringify(extra),
        userId,
        firstSeen,
      ]
    )
    count++
  }

  log(`Seeded ${count} error events.`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('─'.repeat(50))
  log(`Environment:  ${process.env.NODE_ENV ?? 'development'}`)
  log(`Database:     ${(process.env.DATABASE_URL ?? 'default').replace(/:\/\/.*@/, '://<credentials>@')}`)
  log(`Clean mode:   ${CLEAN}`)
  log('─'.repeat(50))

  try {
    if (CLEAN) {
      await truncateTables()
    }

    const users = await seedUsers()

    if (!USERS_ONLY) {
      await seedSubscriptions(users)
      await seedErrorEvents(users)
    }

    log('─'.repeat(50))
    log('Seed complete.')
    log(`  Users:        ${users.length}`)
    if (!USERS_ONLY) {
      log(`  Subscriptions: ${users.filter(u => u.role !== 'admin').length}`)
      log(`  Error events:  50`)
    }
    log('─'.repeat(50))
    process.exit(0)
  } catch (error) {
    console.error('[seed] ERROR:', error.message)
    if (error.stack) console.error(error.stack)
    process.exit(1)
  }
}

main()
