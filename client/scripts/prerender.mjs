/**
 * prerender.mjs — snapshot the built SPA into static HTML so crawlers (and users
 * before the bundle runs) get the real rendered site, not a shell.
 *
 * Runs in "postbuild" (before verify-build.mjs). For `/` and every static route
 * exported by client/src/app/routes/@custom/index.jsx (parsed, not evaluated —
 * scripts/lib/custom-routes.cjs) it:
 *   1. serves client/dist from a throw-away local HTTP server (SPA fallback,
 *      /api/* → 404 JSON, /cookie-consent.js → a stub that pre-accepts essential
 *      cookies so no consent banner ends up in the snapshot);
 *   2. loads the page in headless Chromium, waits for network idle + the page to
 *      have rendered into #root;
 *   3. writes `<!DOCTYPE html>` + document.documentElement.outerHTML to
 *      dist/index.html (for `/`) or dist/<route>/index.html, keeping the webpack
 *      script/link tags so the bundle still mounts and takes over
 *      (main.jsx uses createRoot: it replaces the snapshot with the live tree);
 *   4. turns the local origin back into the `__APP_URL__` placeholder (start.sh /
 *      spaFallback substitute it), removes the runtime theme/brand attributes the
 *      pre-paint script re-derives on every load, refreshes the .gz/.br siblings
 *      CompressionPlugin produced, and records dist/prerender.json
 *      ({ engine, routes }) — server/src/lib/@system/spaFallback.js serves
 *      dist/<route>/index.html when present and treats prerendered routes as known.
 *
 * Browser engines, first available wins:
 *   - Playwright (`playwright` / `playwright-core` / `@playwright/test` resolvable
 *     from client/ or the repo root) with its bundled Chromium
 *     (`npx playwright install --with-deps chromium`), or the executable named by
 *     PRERENDER_CHROMIUM / PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
 *   - a bare Chromium/Chrome binary (PRERENDER_CHROMIUM, or a well-known system
 *     path) driven with `--headless=new --dump-dom` — no npm package needed, which
 *     is what the Docker builder stage can use after `apk add chromium`.
 * With neither, the step is SKIPPED with a notice and the build keeps the
 * build-time fallback markup from index.html (still real content, unstyled).
 * Set PRERENDER=0 to skip explicitly, PRERENDER=require to fail instead of skip,
 * PRERENDER_ENGINE=playwright|dump-dom to force one engine.
 */

import { createServer } from 'node:http'
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs'
import { resolve, dirname, join, extname, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { gzipSync, brotliCompressSync, constants as zlibConstants } from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const clientDir = resolve(__dirname, '..')
const root = resolve(clientDir, '..')
const dist = join(clientDir, 'dist')
const require = createRequire(import.meta.url)
const { readCustomRoutePaths } = require('../../scripts/lib/custom-routes.cjs')

const log = (m) => console.log(`[prerender] ${m}`)
const warn = (m) => console.warn(`[prerender] ${m}`)
const MODE = (process.env.PRERENDER || '').toLowerCase()
const APP_URL_PLACEHOLDER = '__APP_URL__'
const TIMEOUT_MS = Number(process.env.PRERENDER_TIMEOUT_MS || 30_000)

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
  '.map': 'application/json',
}

// Pre-accept essential cookies for the snapshot: neither the static banner
// (cookie-consent.js) nor React's CookieConsentBanner renders, so the crawler
// sees the site, not a consent dialog. Real visitors load the real script.
const COOKIE_CONSENT_STUB = "try{localStorage.setItem('cookie_consent',JSON.stringify({value:'essential',ts:Date.now()}))}catch(e){}\n"

function skip(reason) {
  if (MODE === 'require') {
    console.error(`[prerender] FAIL: ${reason}`)
    process.exit(1)
  }
  warn(`SKIPPED — ${reason}`)
  warn('dist/index.html keeps the build-time fallback markup. To prerender: `npx playwright install --with-deps chromium` (CI) or set PRERENDER_CHROMIUM=/path/to/chromium.')
  process.exit(0)
}

// ─── Static server for dist ──────────────────────────────────────────────────

function serveDist(indexHtml) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    const pathname = decodeURIComponent(url.pathname)
    if (pathname.startsWith('/api/') || pathname === '/api') {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      return res.end('{"message":"Not found (prerender)"}')
    }
    if (pathname === '/cookie-consent.js') {
      res.writeHead(200, { 'Content-Type': MIME['.js'] })
      return res.end(COOKIE_CONSENT_STUB)
    }
    const rel = normalize(pathname).replace(/^(\.\.[/\\])+/, '')
    const file = join(dist, rel)
    if (file.startsWith(dist + sep) && existsSync(file) && statSync(file).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' })
      return res.end(readFileSync(file))
    }
    if (extname(pathname)) {
      res.writeHead(404)
      return res.end()
    }
    res.writeHead(200, { 'Content-Type': MIME['.html'] })
    res.end(indexHtml)
  })
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)))
}

// ─── Browser discovery ───────────────────────────────────────────────────────

function resolvePlaywright() {
  const bases = [clientDir, root]
  for (const base of bases) {
    const req = createRequire(join(base, 'package.json'))
    for (const name of ['playwright', 'playwright-core', '@playwright/test']) {
      try {
        const mod = req(name)
        if (mod && mod.chromium) return { name, base, chromium: mod.chromium }
      } catch { /* try next */ }
    }
  }
  return null
}

const SYSTEM_CHROMIUM = [
  process.env.PRERENDER_CHROMIUM,
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)

function findEngine() {
  const forced = (process.env.PRERENDER_ENGINE || '').toLowerCase() // playwright | dump-dom (default: first available)
  const pw = forced === 'dump-dom' ? null : resolvePlaywright()
  if (pw) {
    let executablePath = process.env.PRERENDER_CHROMIUM || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || ''
    if (!executablePath) {
      try { executablePath = pw.chromium.executablePath() } catch { executablePath = '' }
    }
    if (executablePath && existsSync(executablePath)) return { kind: 'playwright', label: `${pw.name} (${pw.base === root ? 'root' : 'client'} node_modules) · ${executablePath}`, chromium: pw.chromium, executablePath }
    warn(`${pw.name} is installed but its Chromium is not (${executablePath || 'no executable path'})`)
  }
  if (forced === 'playwright') return null
  const binary = SYSTEM_CHROMIUM.find((p) => existsSync(p))
  if (binary) return { kind: 'dump-dom', label: `${binary} --headless --dump-dom`, executablePath: binary }
  return null
}

// ─── Snapshotting ────────────────────────────────────────────────────────────

async function snapshotWithPlaywright(engine, origin, routes) {
  const browser = await engine.chromium.launch({ executablePath: engine.executablePath, args: ['--no-sandbox', '--disable-gpu'] })
  const out = new Map()
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US', reducedMotion: 'reduce' })
    // Only the local dist may be fetched — fonts/analytics/map iframes would stall network idle.
    await context.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()))
    for (const route of routes) {
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.goto(origin + route, { waitUntil: 'networkidle', timeout: TIMEOUT_MS })
      await page.waitForFunction(() => {
        const rootEl = document.getElementById('root')
        return !!rootEl && !!rootEl.querySelector('main, [data-testid="site-page"], [data-imported-root]')
      }, null, { timeout: TIMEOUT_MS })
      // Let the current frame of animations/lazy chunks settle.
      await page.waitForTimeout(250)
      const html = await page.evaluate(() => document.documentElement.outerHTML)
      out.set(route, { html, errors })
      await page.close()
    }
  } finally {
    await browser.close()
  }
  return out
}

function snapshotWithDumpDom(engine, origin, routes) {
  const out = new Map()
  return routes.reduce(
    (p, route) =>
      p.then(
        () =>
          new Promise((ok, fail) => {
            const args = [
              '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--window-size=1280,900',
              `--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1`,
              `--virtual-time-budget=${Math.min(TIMEOUT_MS, 15_000)}`, '--run-all-compositor-stages-before-draw',
              '--dump-dom', origin + route,
            ]
            const child = spawn(engine.executablePath, args, { stdio: ['ignore', 'pipe', 'pipe'] })
            let stdout = ''
            let stderr = ''
            child.stdout.on('data', (d) => { stdout += d })
            child.stderr.on('data', (d) => { stderr += d })
            const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS + 5_000)
            child.on('error', fail)
            child.on('close', (code) => {
              clearTimeout(timer)
              if (code !== 0 || !stdout.includes('<html')) return fail(new Error(`chromium exited ${code}: ${stderr.trim().slice(-400)}`))
              out.set(route, { html: stdout.replace(/^<!DOCTYPE html>\s*/i, ''), errors: [] })
              ok()
            })
          }),
      ),
    Promise.resolve(),
  ).then(() => out)
}

// ─── Post-processing ─────────────────────────────────────────────────────────

function finaliseHtml(html, origin) {
  let out = html
  // The app rewrote canonical/og:url with the local origin — back to the placeholder.
  out = out.split(origin).join(APP_URL_PLACEHOLDER)
  // Runtime-derived attributes brandPrePaint/ThemeProvider set on <html>: drop them so
  // a returning dark-mode visitor does not get a light-mode snapshot flash-locked in.
  out = out.replace(/<html([^>]*)>/i, (m, attrs) => {
    const cleaned = attrs
      .replace(/\s+data-theme="[^"]*"/g, '')
      .replace(/\s+style="[^"]*"/g, '')
      .replace(/\s+class="[^"]*"/g, '')
    return `<html${cleaned}>`
  })
  // Anything the consent stub left behind (belt and braces).
  out = out.replace(/<div id="cc-banner"[\s\S]*?<\/div>\s*(?=<\/body>|<script)/i, '')
  return `<!DOCTYPE html>\n${out}\n`
}

function validateSnapshot(route, html) {
  const problems = []
  if ((html.match(/<script[^>]+type=["']application\/ld\+json["']/gi) || []).length !== 1) problems.push('JSON-LD block count != 1')
  if (!/<html[^>]*\slang=/i.test(html)) problems.push('<html lang> missing')
  if (!/<div id="root"[^>]*>\s*<[a-z]/i.test(html)) problems.push('#root is empty')
  if (!/<script[^>]+src="\/js\/[^"]+"/i.test(html)) problems.push('webpack script tags missing (hydration bundle lost)')
  if (/<script(?![^>]*\ssrc=)(?![^>]*type=["'][^"']*json)[^>]*>\s*\S/i.test(html)) problems.push('inline executable <script> present (CSP forbids it)')
  if (/id="cc-banner"/.test(html)) problems.push('cookie banner captured')
  if (problems.length) throw new Error(`snapshot for ${route} rejected: ${problems.join('; ')}`)
}

function writeWithCompressed(file, html) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, html, 'utf8')
  const buf = Buffer.from(html, 'utf8')
  // CompressionPlugin produced index.html.gz/.br from the webpack shell; refresh or remove them.
  for (const [ext, make] of [
    ['.gz', () => gzipSync(buf, { level: 9 })],
    ['.br', () => brotliCompressSync(buf, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11, [zlibConstants.BROTLI_PARAM_SIZE_HINT]: buf.length } })],
  ]) {
    const sibling = file + ext
    if (buf.length > 10_240) writeFileSync(sibling, make())
    else if (existsSync(sibling)) unlinkSync(sibling)
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (MODE === '0' || MODE === 'false' || MODE === 'off') return log('PRERENDER=0 — skipped')
  const indexPath = join(dist, 'index.html')
  if (!existsSync(indexPath)) return skip('client/dist/index.html not found — run the webpack build first')
  const indexHtml = readFileSync(indexPath, 'utf8')

  const engine = findEngine()
  if (!engine) return skip('no Chromium available (Playwright not resolvable / browser not installed / no system Chrome)')

  const custom = readCustomRoutePaths({ root })
  const routes = ['/', ...custom.paths.filter((p) => p !== '/')]
  if (custom.dynamic.length) log(`dynamic custom routes not prerendered: ${custom.dynamic.join(', ')}`)

  const server = await serveDist(indexHtml)
  const origin = `http://127.0.0.1:${server.address().port}`
  log(`engine: ${engine.label}`)
  log(`serving ${dist} at ${origin}; routes: ${routes.join(' ')}`)

  try {
    const snapshots = engine.kind === 'playwright'
      ? await snapshotWithPlaywright(engine, origin, routes)
      : await snapshotWithDumpDom(engine, origin, routes)

    const written = []
    for (const route of routes) {
      const snap = snapshots.get(route)
      if (!snap) throw new Error(`no snapshot for ${route}`)
      if (snap.errors.length) warn(`${route}: page errors during render: ${snap.errors.slice(0, 3).join(' | ')}`)
      const html = finaliseHtml(snap.html, origin)
      validateSnapshot(route, html)
      const target = route === '/' ? indexPath : join(dist, route.replace(/^\/+/, ''), 'index.html')
      writeWithCompressed(target, html)
      written.push(route)
      log(`wrote ${target.replace(root + sep, '')} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`)
    }
    writeFileSync(join(dist, 'prerender.json'), JSON.stringify({ engine: engine.kind, routes: written }, null, 2) + '\n')
    log(`done — ${written.length} route(s) prerendered`)
  } finally {
    server.close()
  }
}

main().catch((err) => {
  console.error(`[prerender] FAIL: ${err.message}`)
  process.exit(1)
})
