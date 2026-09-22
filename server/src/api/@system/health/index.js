// @system — liveness + readiness endpoints
//
//   GET /health, /api/health  liveness  — always 200 while the process answers;
//                                         body carries the detailed state
//                                         (db, auth, version) for monitoring.
//   GET /ready,  /api/ready   readiness — 200 only when the database answers,
//                                         503 otherwise. Deploy pipelines and
//                                         docker-compose gate on this one.
//
// Why two endpoints: App Runner's own health check should stay on /api/health
// so a transient DB blip (credentials rotating, RDS restart) never rolls a
// deployment back or restarts a healthy process. The deploy workflow, on the
// other hand, must fail loudly when the new image cannot reach the DB — that
// is /api/ready. See docs/DEPLOYMENT.md "Health and verification".
const express = require('express')
const fs = require('fs')
const path = require('path')
const router = express.Router()
const db = require('../../../lib/@system/PostgreSQL')
const { dbSource } = db
const { signAccessTokenAsync, verifyAccessTokenAsync } = require('../../../lib/@system/Helpers/jwt')

// Resolve version once at startup.
// Priority: VERSION env → VERSION file (absolute + relative) → package.json → Git SHA → 'unknown'
// The Dockerfile stamps /app/VERSION as "<semver>+<short sha>" at build time and
// start.sh exports it as VERSION before the server starts (#30931).
function resolveVersion() {
  // 1. VERSION env var — set by start.sh from /app/VERSION (or by the operator)
  if (process.env.VERSION) {
    return process.env.VERSION
  }
  // 2. VERSION file — absolute Docker path first (most reliable), then relative depths
  const candidates = [
    '/app/VERSION',
    path.resolve(__dirname, '../../../../../VERSION'),
    path.resolve(__dirname, '../../../../VERSION'),
  ]
  for (const p of candidates) {
    try {
      const v = fs.readFileSync(p, 'utf8').trim()
      if (v) return v
    } catch (_) { /* continue */ }
  }
  // 3. package.json version — try root (5 up) then server (4 up)
  for (const rel of ['../../../../../package.json', '../../../../package.json']) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, rel), 'utf8'))
      if (pkg.version && pkg.version !== '0.0.0') return pkg.version
    } catch (_) { /* continue */ }
  }
  // 4. Git SHA — GIT_SHA is set by the Dockerfile from the BUILD_SHA build arg
  //    (also used by ErrorTracking as the Sentry release). "local" = unstamped build.
  const sha = process.env.GIT_SHA
  if (sha && sha !== 'local') {
    return sha.slice(0, 8)
  }
  return 'unknown'
}

const APP_VERSION = resolveVersion()

// Which product template this app was generated from, and the template version
// it is on (VERSION). Orkosi's template-versioning reads `template` from
// /api/health to show "Version X.Y.Z available" without touching git.
function resolveTemplate() {
  const candidates = [
    '/app/template-manifest.json',
    path.resolve(__dirname, '../../../../../template-manifest.json'),
    path.resolve(__dirname, '../../../../template-manifest.json'),
  ]
  for (const p of candidates) {
    try {
      const m = JSON.parse(fs.readFileSync(p, 'utf8'))
      return { slug: m.templateSlug || m.templateType || null, repo: m.templateRepo || null, version: TEMPLATE_VERSION }
    } catch (_) { /* continue */ }
  }
  return { slug: null, repo: null, version: TEMPLATE_VERSION }
}

// The Docker image appends "+<build sha>" to /app/VERSION; the template version is the semver part.
const TEMPLATE_VERSION = String(APP_VERSION).split('+')[0]

const TEMPLATE = resolveTemplate()

// Probe JWT sign+verify in one round-trip using a throwaway payload.
// Returns 'ok' when both keys are configured and the round-trip succeeds,
// 'misconfigured' when keys are missing/invalid, or 'error:<message>' on
// unexpected failures — enough detail to diagnose deployed auth issues
// (#19630 #19633 #19644) without leaking any real user material.
async function checkAuth() {
  try {
    const token = await signAccessTokenAsync({ sub: 'health-probe' }, { expiresIn: '5s' })
    await verifyAccessTokenAsync(token)
    return 'ok'
  } catch (err) {
    if (err.message && err.message.includes('JWT keys not configured')) return 'misconfigured'
    if (err.message && (err.message.includes('secretOrPrivateKey') || err.message.includes('secretOrPublicKey'))) {
      return 'misconfigured'
    }
    return `error:${err.message}`
  }
}

// Run the DB + auth probes once and shape the shared response body.
// Redis is optional — all usages (cache, email queue, rate limiting) fall back
// gracefully when Redis is absent, so it is deliberately not probed (#26487).
async function probe() {
  const checks = { server: 'ok', db: 'connected', auth: 'ok' }

  let dbError
  try {
    await db.one('SELECT 1')
  } catch (err) {
    checks.db = 'disconnected'
    dbError = err.code || err.message?.split('\n')[0]?.slice(0, 120)
  }

  checks.auth = await checkAuth()

  const healthy = checks.db !== 'disconnected' && checks.auth === 'ok'

  const body = {
    status: healthy ? 'ok' : 'degraded',
    database: checks.db,
    db: checks.db,
    db_source: dbSource,
    auth: checks.auth,
    timestamp: new Date().toISOString(),
    version: APP_VERSION,
    template: TEMPLATE,
    uptime: Math.floor(process.uptime()),
    checks,
  }
  // Include db_error only when disconnected — helps diagnose without leaking secrets (#31258)
  if (dbError) body.db_error = dbError
  return body
}

// GET /health, /api/health — liveness. Always 200: the platform health check
// must not restart or roll back a process that is up but temporarily cannot
// reach the database (credentials rotating, RDS maintenance). A 503 here once
// reverted every deploy with DB issues before the credential fix could land
// (#18857). Consumers that need the DB state read the body or call /ready.
router.get('/health', async (_req, res) => {
  res.status(200).json(await probe())
})

// GET /ready, /api/ready — readiness. 503 until the database answers.
// This is the endpoint the deploy workflow verifies after a rollout, what
// docker-compose uses as HEALTHCHECK, and what a load balancer should target
// when it must stop routing to an instance without a database.
router.get('/ready', async (_req, res) => {
  const body = await probe()
  const ready = body.db === 'connected'
  res.status(ready ? 200 : 503).json({ ...body, ready })
})

// Reject non-GET methods explicitly before auth/csrf middleware intercepts
router.all('/health', (_req, res) => res.status(404).json({ message: 'Not found' }))
router.all('/ready', (_req, res) => res.status(404).json({ message: 'Not found' }))

module.exports = router
