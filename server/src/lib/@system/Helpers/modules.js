// @system — feature-module resolver (server side)
//
// brand.json is the single source of truth for which optional product modules
// are switched on:
//
//   "modules": { "billing": false, "teams": false, "selfRegistration": false, ... }
//
// Every module DEFAULTS TO TRUE when its key is absent, so a brand.json without
// a `modules` block (the SaaS template, every product provisioned before this
// existed) behaves exactly as before. The informational template ships all of
// them off — a brochure site has no billing, teams, API keys, AI, etc.
//
// The same map gates four seams, so a module is either fully present or fully
// absent:
//   - server/src/routes/@system/index.js       → API routers (ROUTER_MODULES)
//   - server/src/db/migrations/@system/run.js  → migrations (MIGRATION_MODULES)
//   - server/src/scheduler/tasks/@system        → scheduled tasks (BaseTask.module)
//   - client/src/config/@system/modules.js     → routes, sidebar, auth page
//     (fed by webpack's __MODULES__ DefinePlugin constant from the same file)
//
// Optional env override for one-off environments (never for products — edit
// brand.json instead): MODULES_JSON='{"billing":true}'.

const fs = require('fs')
const path = require('path')

/** Canonical module keys. Unknown keys in brand.json are passed through untouched. */
const MODULE_KEYS = Object.freeze([
  'billing',
  'teams',
  'selfRegistration',
  'apiKeys',
  'web3',
  'ai',
  'usage',
  'onboarding',
  'blog',
  'webhooks',
])

/** Absent key → enabled, so upstream (SaaS) behaviour is unchanged. */
const MODULE_DEFAULTS = Object.freeze(Object.fromEntries(MODULE_KEYS.map((k) => [k, true])))

/**
 * API router (directory / file name under server/src/api/@system) → module key.
 * Routers not listed here are always mounted (auth, sessions, users, contact,
 * health, csrf, robots, sitemap, gdpr, email, notifications, storage, admin, ...).
 */
const ROUTER_MODULES = Object.freeze({
  ai: 'ai',
  threads: 'ai', // AI chat threads + messages
  'api-keys': 'apiKeys',
  blog: 'blog',
  ghost: 'blog', // Ghost CMS publish webhook writes blog_posts
  onboarding: 'onboarding',
  payments: 'billing',
  polar: 'billing',
  stripe: 'billing',
  subscriptions: 'billing',
  teams: 'teams',
  usage: 'usage',
  web3: 'web3',
  webhooks: 'webhooks',
})

/**
 * Migration file (basename without .js) → module key(s). A migration listed
 * with an array runs when ANY of those modules is enabled. Files not listed
 * always run. Skipped migrations are never recorded in schema_migrations, so
 * enabling the module later applies them on the next boot.
 *
 * Deliberately NOT gated (always-on code depends on them):
 *   001_init                    users + subscriptions (subscriptions is FK'd by brands 019)
 *   011_onboarding              SessionRepo selects u.onboarding_completed on every session auth
 *   020_billing_infrastructure  creates notifications/credits/transactions used by
 *                               notifications + admin APIs
 */
const MIGRATION_MODULES = Object.freeze({
  '004_api_keys': 'apiKeys',
  '009_polar_subscriptions': 'billing',
  '010_stripe_customer_id': 'billing',
  '012_stripe_subscriptions': 'billing',
  '014_payment_provider': 'billing',
  '022_teams': 'teams',
  '023_blog_posts': 'blog',
  '024_api_key_enhancements': 'apiKeys',
  '025_webhooks': 'webhooks',
  '026_metrics_threads_messages': 'ai',
})

const DEFAULT_BRAND_PATH = path.resolve(__dirname, '../../../../../brand.json')

/**
 * Normalise a raw `modules` object: booleans are kept, `"true"`/`"false"`
 * strings are coerced, anything else falls back to the default (enabled).
 */
function normalizeModules(raw) {
  const out = { ...MODULE_DEFAULTS }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'boolean') out[key] = value
    else if (value === 'true' || value === 'false') out[key] = value === 'true'
    else if (!(key in out)) out[key] = true
  }
  return out
}

/**
 * Resolve the module map from brand.json (+ optional MODULES_JSON override).
 * Never throws: a missing/invalid brand.json yields the all-enabled defaults.
 */
function loadModules(brandPath = DEFAULT_BRAND_PATH, env = process.env) {
  let fromBrand = {}
  try {
    const brand = JSON.parse(fs.readFileSync(brandPath, 'utf8'))
    if (brand && typeof brand.modules === 'object') fromBrand = brand.modules
  } catch {
    /* no brand.json (tests, fresh clone) → defaults */
  }

  let fromEnv = {}
  if (env && typeof env.MODULES_JSON === 'string' && env.MODULES_JSON.trim()) {
    try {
      const parsed = JSON.parse(env.MODULES_JSON)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) fromEnv = parsed
    } catch {
      /* malformed override is ignored, brand.json wins */
    }
  }

  return normalizeModules({ ...fromBrand, ...fromEnv })
}

/** Process-wide resolved map (read once at boot, like the CSP block). */
const modules = loadModules()

/** `true` unless the module is explicitly switched off. Unknown keys are enabled. */
function isEnabled(key, map = modules) {
  return map[key] !== false
}

/** Should the API router with this @system name be mounted? */
function isRouterEnabled(routerName, map = modules) {
  const moduleKey = ROUTER_MODULES[routerName]
  return moduleKey ? isEnabled(moduleKey, map) : true
}

/** Should this migration file run? Accepts "009_polar_subscriptions" or "…js". */
function isMigrationEnabled(fileName, map = modules) {
  const base = String(fileName).replace(/\.js$/, '')
  const owner = MIGRATION_MODULES[base]
  if (!owner) return true
  const keys = Array.isArray(owner) ? owner : [owner]
  return keys.some((k) => isEnabled(k, map))
}

/**
 * Split a discovered migration list into the ones to run and the ones skipped
 * because their module is off. Pure — used by the runner and its tests.
 */
function partitionMigrations(migrations, map = modules) {
  const run = []
  const skipped = []
  for (const m of migrations) {
    const name = typeof m === 'string' ? m : m.name
    ;(isMigrationEnabled(name, map) ? run : skipped).push(m)
  }
  return { run, skipped }
}

/**
 * Express middleware: 403 when the module is off. Used on endpoints that live
 * inside an always-on router but belong to a module (e.g. self-registration
 * inside the auth router).
 */
function requireModule(key, message) {
  return function moduleGate(_req, res, next) {
    if (isEnabled(key)) return next()
    return res.status(403).json({
      message: message || `The "${key}" module is disabled for this site.`,
      code: 'MODULE_DISABLED',
      module: key,
    })
  }
}

const SELF_REGISTRATION_DISABLED_MESSAGE =
  'Self-registration is disabled for this site. Ask an administrator to create your account.'

module.exports = {
  MODULE_KEYS,
  MODULE_DEFAULTS,
  ROUTER_MODULES,
  MIGRATION_MODULES,
  DEFAULT_BRAND_PATH,
  SELF_REGISTRATION_DISABLED_MESSAGE,
  modules,
  normalizeModules,
  loadModules,
  isEnabled,
  isRouterEnabled,
  isMigrationEnabled,
  partitionMigrations,
  requireModule,
}
