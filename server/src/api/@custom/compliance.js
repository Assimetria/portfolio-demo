// @custom — infrastructure + legal compliance status (task #1062103)
//
// Creative Portfolio is lifecycle=live but had no machine-readable evidence of
// infrastructure readiness or legal compliance. These endpoints surface both
// from signals the server already owns (env presence, DB, brand.json, the
// route manifest, retention config) — no secrets are ever echoed back, only
// "configured" / "missing" style states.
//
//   GET /api/compliance/status          admin  — combined lifecycle + infra + legal
//   GET /api/compliance/infrastructure  admin  — db, migrations, error tracking,
//                                                email, redis, secrets, backups (RPO/RTO)
//   GET /api/compliance/legal           public — legal pages, GDPR API, consent log,
//                                                retention windows, privacy contact
//
// Every check is { ok, required, ... }. A section is "compliant" when every
// *required* check passes; recommended checks are reported but never fail it.

const express = require('express')
const fs = require('fs')
const path = require('path')
const router = express.Router()

const { authenticate, requireAdmin } = require('../../lib/@system/Helpers')
const db = require('../../lib/@system/PostgreSQL')
const { loadBrand } = require('../../lib/@system/Brand')
const contactConfig = require('../@system/contact/config')

const IS_PROD = process.env.NODE_ENV === 'production'

// Documented operations targets — docs/RUNBOOK.md section 15 (template defaults).
const BACKUP_POLICY = Object.freeze({
  rpoHours: 24,
  rpoMinutesWithPitr: 5, // when RDS point-in-time recovery is enabled
  rtoApplicationMinutes: 15,
  rtoDatabaseMinutes: 60,
  runbook: 'docs/RUNBOOK.md#13-database-backup-and-restore-drill',
})

// Legal pages every live product must publish (client/src/app/routes/@system/manifest.json).
const REQUIRED_LEGAL_PAGES = Object.freeze([
  { key: 'privacy', path: '/privacy' },
  { key: 'terms', path: '/terms' },
  { key: 'cookies', path: '/cookies' },
])
const RECOMMENDED_LEGAL_PAGES = Object.freeze([
  { key: 'dpa', path: '/dpa' },
])

const DEFAULT_AUDIT_RETENTION_DAYS = 90

// ── helpers ────────────────────────────────────────────────────────────────────

function isSet(name) {
  return typeof process.env[name] === 'string' && process.env[name].trim() !== ''
}

function readFirstFile(candidates) {
  for (const p of candidates) {
    try {
      const v = fs.readFileSync(p, 'utf8')
      if (v) return v
    } catch (_) { /* try next */ }
  }
  return null
}

function resolveVersion() {
  if (isSet('VERSION')) return process.env.VERSION
  const raw = readFirstFile([
    '/app/VERSION',
    path.resolve(__dirname, '../../../../VERSION'),
  ])
  return raw ? raw.trim() : 'unknown'
}

function resolveLifecycle(brand) {
  if (isSet('APP_LIFECYCLE')) return process.env.APP_LIFECYCLE.trim()
  if (brand && typeof brand.lifecycle === 'string' && brand.lifecycle) return brand.lifecycle
  return IS_PROD ? 'live' : 'development'
}

function loadRouteManifest() {
  const raw = readFirstFile([
    path.resolve(__dirname, '../../../../client/src/app/routes/@system/manifest.json'),
    path.resolve(process.cwd(), 'client/src/app/routes/@system/manifest.json'),
    '/app/route-manifest.json',
  ])
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (_) {
    return null
  }
}

function manifestPaths(manifest) {
  const paths = new Set()
  if (!manifest) return paths
  for (const section of ['static', 'app', 'admin']) {
    for (const route of manifest[section] || []) {
      if (route && typeof route.path === 'string') paths.add(route.path)
    }
  }
  for (const redirect of manifest.redirects || []) {
    if (redirect && typeof redirect.from === 'string') paths.add(redirect.from)
  }
  return paths
}

function sectionStatus(checks) {
  const failed = Object.entries(checks)
    .filter(([, c]) => c.required && !c.ok)
    .map(([name]) => name)
  return { status: failed.length === 0 ? 'compliant' : 'non_compliant', failed }
}

// ── infrastructure ─────────────────────────────────────────────────────────────

function detectEmailProvider() {
  const explicit = (process.env.EMAIL_PROVIDER || '').toLowerCase()
  if (explicit === 'console') return 'console'
  if (explicit === 'resend' || (!explicit && isSet('RESEND_API_KEY') && !isSet('SMTP_HOST'))) return 'resend'
  if (explicit === 'ses' || (!explicit && isSet('AWS_ACCESS_KEY_ID') && !isSet('SMTP_HOST'))) return 'ses'
  if (explicit === 'smtp' || isSet('SMTP_HOST')) return 'smtp'
  return 'console'
}

async function infrastructureChecks() {
  const checks = {}

  // Database reachability
  try {
    await db.one('SELECT 1')
    checks.database = { ok: true, required: true, state: 'connected' }
  } catch (err) {
    checks.database = {
      ok: false,
      required: true,
      state: 'disconnected',
      error: err.code || String(err.message || '').split('\n')[0].slice(0, 120),
    }
  }

  // Schema migrations applied (schema_migrations is maintained by migrations/@system/run.js)
  if (checks.database.ok) {
    try {
      const row = await db.one('SELECT COUNT(*)::int AS count FROM schema_migrations')
      checks.migrations = { ok: row.count > 0, required: true, applied: row.count }
    } catch (err) {
      checks.migrations = { ok: false, required: true, applied: 0, error: err.code || 'query_failed' }
    }
  } else {
    checks.migrations = { ok: false, required: true, applied: 0, error: 'database_unavailable' }
  }

  // Error tracking — Sentry DSN (start.sh also accepts ERROR_TRACKING_DSN)
  const sentry = isSet('SENTRY_DSN') || isSet('ERROR_TRACKING_DSN')
  checks.errorTracking = {
    ok: sentry,
    required: IS_PROD,
    state: sentry ? 'configured' : 'missing',
    provider: 'sentry',
  }

  // Transactional email — mirrors lib/@system/Email transport detection
  const emailProvider = detectEmailProvider()
  checks.email = {
    ok: emailProvider !== 'console',
    required: IS_PROD,
    state: emailProvider === 'console' ? 'console_only' : 'configured',
    provider: emailProvider,
  }

  // Redis is optional everywhere (cache, queues and rate limiting fall back) — recommended only
  checks.redis = {
    ok: isSet('REDIS_URL'),
    required: false,
    state: isSet('REDIS_URL') ? 'configured' : 'not_configured',
  }

  // Public origin — CORS allow-list, email links, sitemap
  const appUrl = (process.env.APP_URL || '').trim()
  const appUrlOk = appUrl !== '' && (!IS_PROD || appUrl.startsWith('https://'))
  checks.appUrl = {
    ok: appUrlOk,
    required: true,
    state: appUrl === '' ? 'missing' : appUrlOk ? 'configured' : 'insecure',
  }

  // Auth + CSRF secrets present (values never returned)
  const secretNames = ['JWT_PRIVATE_KEY', 'JWT_PUBLIC_KEY', 'CSRF_SECRET']
  const missingSecrets = secretNames.filter((k) => !isSet(k))
  checks.secrets = {
    ok: missingSecrets.length === 0,
    required: IS_PROD,
    state: missingSecrets.length === 0 ? 'configured' : 'incomplete',
    missing: missingSecrets,
  }

  // Backups — RDS automated snapshots are owned by provisioning; the app reports the
  // documented policy and the drill runbook so the target is auditable from /api.
  checks.backups = {
    ok: true,
    required: true,
    state: 'documented',
    policy: BACKUP_POLICY,
  }

  // Release identity — /api/health reports the same value
  const version = resolveVersion()
  checks.version = { ok: version !== 'unknown', required: false, value: version }

  return { ...sectionStatus(checks), checks }
}

// ── legal ──────────────────────────────────────────────────────────────────────

function gdprApiAvailable() {
  try {
    require.resolve('../@system/gdpr')
    return true
  } catch (_) {
    return false
  }
}

async function legalChecks(brand) {
  const checks = {}
  const manifest = loadRouteManifest()
  const known = manifestPaths(manifest)

  // Public legal pages — verified against the generated route manifest when available
  const pages = {}
  for (const page of REQUIRED_LEGAL_PAGES) {
    pages[page.key] = { path: page.path, present: manifest ? known.has(page.path) : true, required: true }
  }
  for (const page of RECOMMENDED_LEGAL_PAGES) {
    pages[page.key] = { path: page.path, present: manifest ? known.has(page.path) : true, required: false }
  }
  checks.legalPages = {
    ok: Object.values(pages).every((p) => !p.required || p.present),
    required: true,
    source: manifest ? 'route-manifest' : 'unverified',
    pages,
  }

  // GDPR data-subject rights API (Art. 7 consent, Art. 15 export, Art. 17 erasure)
  const gdpr = gdprApiAvailable()
  checks.gdprApi = {
    ok: gdpr,
    required: true,
    endpoints: gdpr
      ? ['POST /api/gdpr/consent', 'GET /api/gdpr/my-data', 'DELETE /api/gdpr/my-data']
      : [],
  }

  // Cookie consent log table (migration 015_gdpr_compliance)
  try {
    const row = await db.oneOrNone("SELECT to_regclass('gdpr_consent_log') AS name")
    const present = Boolean(row && row.name)
    checks.cookieConsent = {
      ok: present,
      required: true,
      state: present ? 'consent_log_ready' : 'consent_log_missing',
    }
  } catch (err) {
    checks.cookieConsent = {
      ok: false,
      required: true,
      state: 'unverified',
      error: err.code || 'database_unavailable',
    }
  }

  // Retention windows — contact submissions (brand → env → 180) and audit logs (env → 90)
  const auditEnv = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '', 10)
  const auditDays = Number.isInteger(auditEnv) && auditEnv > 0 ? auditEnv : DEFAULT_AUDIT_RETENTION_DAYS
  checks.retention = {
    ok: true,
    required: true,
    contactSubmissionsDays: contactConfig.retentionDays(brand),
    auditLogsDays: auditDays,
  }

  // Privacy / DPO contact — brand.legal.privacyEmail → brand.legal.dpoEmail →
  // brand.site.contact.email → PRIVACY_CONTACT_EMAIL. Only presence is reported.
  const legal = brand && typeof brand.legal === 'object' && brand.legal ? brand.legal : {}
  const site = brand && typeof brand.site === 'object' && brand.site ? brand.site : {}
  const contact = site && typeof site.contact === 'object' && site.contact ? site.contact : {}
  const privacyEmail = [legal.privacyEmail, legal.dpoEmail, contact.email, process.env.PRIVACY_CONTACT_EMAIL]
    .find((v) => typeof v === 'string' && v.trim() !== '')
  checks.privacyContact = {
    ok: Boolean(privacyEmail),
    required: IS_PROD,
    state: privacyEmail ? 'configured' : 'missing',
  }

  // Effective date of the published policies (brand.legal.effectiveDate), if declared
  const effectiveDate = typeof legal.effectiveDate === 'string' && legal.effectiveDate ? legal.effectiveDate : null
  checks.effectiveDate = {
    ok: Boolean(effectiveDate),
    required: false,
    value: effectiveDate,
  }

  return { ...sectionStatus(checks), checks }
}

// ── routes ─────────────────────────────────────────────────────────────────────

// GET /api/compliance/status — admin-only combined report
router.get('/compliance/status', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const brand = loadBrand()
    const [infrastructure, legal] = await Promise.all([infrastructureChecks(), legalChecks(brand)])
    const compliant = infrastructure.status === 'compliant' && legal.status === 'compliant'
    res.json({
      lifecycle: resolveLifecycle(brand),
      status: compliant ? 'compliant' : 'non_compliant',
      infrastructure,
      legal,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/compliance/infrastructure — admin-only infrastructure readiness
router.get('/compliance/infrastructure', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const brand = loadBrand()
    const infrastructure = await infrastructureChecks()
    res.json({
      lifecycle: resolveLifecycle(brand),
      ...infrastructure,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/compliance/legal — public; only data that is already public
// (policy URLs, retention windows, whether the GDPR API exists). No PII.
router.get('/compliance/legal', async (req, res, next) => {
  try {
    const brand = loadBrand()
    const legal = await legalChecks(brand)
    res.json({
      lifecycle: resolveLifecycle(brand),
      ...legal,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
