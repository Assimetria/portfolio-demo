#!/usr/bin/env node
/**
 * scripts/e2e-server.js — boot the app for Playwright the way the Docker image
 * does: Express in NODE_ENV=production serving the built client. Used as the
 * Playwright `webServer` (see playwright.config.js).
 *
 *  - Builds client/dist first if it is missing (npm run build).
 *  - Copies client/dist to a temp dir and applies the same runtime placeholder
 *    handling as start.sh (APP_URL, Plausible/Sentry stripped when unset,
 *    brand name) so the served index.html matches production.
 *  - Generates an ephemeral RS256 key pair (like start.sh) unless JWT keys are set.
 *  - Without DATABASE_URL the server is pointed at an unreachable address so it
 *    boots degraded (health: db=disconnected) and can never touch a real local
 *    database by accident. Set DATABASE_URL to run DB-backed specs.
 *
 * Env: E2E_PORT (default 3000), DATABASE_URL, APP_URL, PLAUSIBLE_DOMAIN, SENTRY_DSN,
 *      JWT_PRIVATE_KEY[_FILE], JWT_PUBLIC_KEY[_FILE]
 */
const { spawn, execSync } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const distDir = path.join(root, 'client', 'dist')
const port = process.env.E2E_PORT || process.env.PORT || '3000'
const appUrl = process.env.APP_URL || `http://localhost:${port}`

const log = (msg) => console.log(`[e2e-server] ${msg}`)

// 1. Built client
if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  log('client/dist/index.html missing — running `npm run build` (prebuild + webpack)...')
  execSync('npm run build', { cwd: root, stdio: 'inherit' })
}

// 2. Serve a copy of client/dist with start.sh's runtime substitutions applied
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pt-e2e-'))
const serveDir = path.join(tmpRoot, 'dist')
fs.cpSync(distDir, serveDir, { recursive: true })

const indexPath = path.join(serveDir, 'index.html')
let html = fs.readFileSync(indexPath, 'utf8')
html = html.split('__APP_URL__').join(appUrl)
if (process.env.PLAUSIBLE_DOMAIN) {
  html = html.split('__PLAUSIBLE_DOMAIN__').join(process.env.PLAUSIBLE_DOMAIN)
} else {
  html = html.replace(/<script[^>]*data-domain="__PLAUSIBLE_DOMAIN__"[^>]*><\/script>/g, '')
}
if (process.env.SENTRY_DSN) {
  html = html.split('__SENTRY_DSN__').join(process.env.SENTRY_DSN)
} else {
  html = html.replace(/<meta name="sentry-dsn"[^>]*>/g, '')
}
try {
  const brand = JSON.parse(fs.readFileSync(path.join(root, 'brand.json'), 'utf8'))
  const name = brand.companyName || brand.name || ''
  if (name) {
    html = html.split('__BRAND_NAME__').join(name)
    html = html.split('__BRAND_TAGLINE__').join(brand.tagline || '')
    html = html.split('__BRAND_COLOR__').join(brand.primaryColor || brand.brand_color || '')
    html = html.split('__BRAND_ACCENT__').join(brand.accentColor || brand.accent_color || '')
  }
} catch {
  /* brand.json optional here — webpack already baked the brand into index.html */
}
fs.writeFileSync(indexPath, html)
log(`serving client build from ${serveDir}`)

// 3. Environment mirroring start.sh
const env = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: String(port),
  BIND_HOST: process.env.BIND_HOST || '127.0.0.1',
  SPA_HTML_DIR: serveDir,
  APP_URL: appUrl,
  VERSION: process.env.VERSION || fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim(),
  // Migrations are the entrypoint's job (start.sh); never run them from the e2e harness.
  SKIP_STARTUP_MIGRATIONS: '1',
  LOG_LEVEL: process.env.LOG_LEVEL || 'warn',
}

if (!env.DATABASE_URL) {
  // TCP port 1 is never a Postgres — connection is refused immediately → degraded mode.
  env.DATABASE_URL = 'postgresql://e2e:e2e@127.0.0.1:1/e2e_unreachable'
  log('DATABASE_URL not set — running degraded (db: disconnected). DB-backed specs are skipped.')
}

if (!env.JWT_PRIVATE_KEY && !env.JWT_PRIVATE_KEY_FILE) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  fs.writeFileSync(path.join(tmpRoot, 'private.pem'), privateKey, { mode: 0o600 })
  fs.writeFileSync(path.join(tmpRoot, 'public.pem'), publicKey)
  env.JWT_PRIVATE_KEY_FILE = path.join(tmpRoot, 'private.pem')
  env.JWT_PUBLIC_KEY_FILE = path.join(tmpRoot, 'public.pem')
  log('JWT keys not set — generated an ephemeral RS256 pair.')
}

if (!env.CSRF_SECRET) env.CSRF_SECRET = crypto.randomBytes(32).toString('hex')

// 4. Start Express
log(`starting server/src/index.js on http://localhost:${port} (NODE_ENV=production)`)
const child = spawn(process.execPath, [path.join(root, 'server', 'src', 'index.js')], {
  cwd: root,
  env,
  stdio: 'inherit',
})

const cleanup = () => {
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }) } catch { /* ignore */ }
}
const forward = (signal) => () => child.kill(signal)
process.on('SIGINT', forward('SIGINT'))
process.on('SIGTERM', forward('SIGTERM'))
child.on('exit', (code, signal) => {
  cleanup()
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})
