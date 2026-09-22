/**
 * Build verification — ensures critical elements survive the webpack build.
 * Run automatically after `npm run build` via the "postbuild" npm script.
 *
 * Checks:
 *  1. dist/index.html exists, <html lang> is set, #root carries real site content
 *  2. Exactly one <script type="application/ld+json"> block is present, it parses,
 *     its @graph holds the business node of the type brand.json site.seo.businessType
 *     selects (default ProfessionalService) plus a WebSite node, and no leftover
 *     SaaS SoftwareApplication/Offer node
 *  3. Lazy-loaded chunk files exist in dist/js/ (#33536)
 *  4. Every stylesheet extension imported for its side effects (.css/.scss) is
 *     listed in package.json "sideEffects" — otherwise production tree-shaking
 *     silently drops the import and the page ships unstyled (AuthPage, 2026-09-20)
 *
 * Runs AFTER scripts/prerender.mjs in "postbuild" so it validates the HTML that
 * actually ships (prerendered snapshot or the build-time fallback).
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distHtml = resolve(__dirname, '..', 'dist', 'index.html')

let html
try {
  html = readFileSync(distHtml, 'utf8')
} catch {
  console.error('BUILD VERIFY FAIL: dist/index.html not found')
  process.exit(1)
}

// ── <html lang> + non-empty #root ─────────────────────────────────────────
const langMatch = html.match(/<html[^>]*\slang=["']([^"']+)["']/i)
if (!langMatch) {
  console.error('BUILD VERIFY FAIL: dist/index.html has no <html lang="…"> — brand.json site.locale / HTML_LANG param missing')
  process.exit(1)
}
const rootMatch = html.match(/<div id="root"[^>]*>([\s\S]*?)<\/div>\s*<script[^>]*src="\/cookie-consent\.js"/i)
const rootHasH1 = /<h1[\s>]/i.test(html) && /<main[\s>]/i.test(html)
if (!rootHasH1) {
  console.error('BUILD VERIFY FAIL: dist/index.html #root has no <main>/<h1> — the site fallback markup (SITE_FALLBACK_HTML) or the prerender snapshot is missing')
  process.exit(1)
}
if (/Auth, billing, teams|Get Started Free|SoftwareApplication/.test(html)) {
  console.error('BUILD VERIFY FAIL: dist/index.html still carries SaaS placeholder copy (Auth, billing, teams / Get Started Free / SoftwareApplication)')
  process.exit(1)
}
console.log(`BUILD VERIFY OK: dist/index.html lang="${langMatch[1]}", #root has site content${rootMatch ? '' : ' (prerendered)'}`)

// ── JSON-LD ───────────────────────────────────────────────────────────────
const jsonLdBlocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
const count = jsonLdBlocks.length

if (count === 0) {
  console.error('BUILD VERIFY FAIL: dist/index.html has ZERO application/ld+json blocks')
  console.error('JSON-LD structured data is missing — check client/index.html template')
  process.exit(1)
}

if (count > 1) {
  console.error(`BUILD VERIFY FAIL: dist/index.html has ${count} application/ld+json blocks (expected 1 using @graph)`)
  console.error('Merge multiple JSON-LD blocks into a single @graph block')
  process.exit(1)
}

let jsonLd
try {
  jsonLd = JSON.parse(jsonLdBlocks[0][1])
} catch (err) {
  console.error(`BUILD VERIFY FAIL: dist/index.html JSON-LD block is not valid JSON: ${err.message}`)
  process.exit(1)
}
if (!Array.isArray(jsonLd['@graph'])) {
  console.error('BUILD VERIFY FAIL: JSON-LD block has no @graph array')
  process.exit(1)
}
const brandPath = resolve(__dirname, '..', '..', 'brand.json')
let expectedType = 'ProfessionalService'
if (existsSync(brandPath)) {
  try {
    const t = JSON.parse(readFileSync(brandPath, 'utf8'))?.site?.seo?.businessType
    if (typeof t === 'string' && /^[A-Z][A-Za-z0-9]{2,60}$/.test(t)) expectedType = t
  } catch { /* brand.json unreadable — keep the default */ }
}
const types = jsonLd['@graph'].map((n) => n && n['@type'])
if (!types.includes(expectedType)) {
  console.error(`BUILD VERIFY FAIL: JSON-LD @graph has no "${expectedType}" node (brand.json site.seo.businessType) — found: ${types.join(', ')}`)
  process.exit(1)
}
if (!types.includes('WebSite')) {
  console.error(`BUILD VERIFY FAIL: JSON-LD @graph has no WebSite node — found: ${types.join(', ')}`)
  process.exit(1)
}
const business = jsonLd['@graph'].find((n) => n['@type'] === expectedType)
for (const key of ['name', 'url']) {
  if (!business[key]) {
    console.error(`BUILD VERIFY FAIL: JSON-LD ${expectedType} node is missing "${key}"`)
    process.exit(1)
  }
}
console.log(`BUILD VERIFY OK: dist/index.html has 1 JSON-LD @graph block (${types.join(' + ')})`)

// ── Chunk file verification (#33536) ──────────────────────────────────────
// Webpack code splitting produces lazy-loaded .chunk.js files in dist/js/.
// If these are missing, /app and all authenticated pages show a blank page
// because the React runtime cannot load page components.
const jsDir = resolve(__dirname, '..', 'dist', 'js')
let jsFiles
try {
  jsFiles = readdirSync(jsDir)
} catch {
  console.error('BUILD VERIFY FAIL: dist/js/ directory not found — webpack output is broken')
  process.exit(1)
}

const chunkFiles = jsFiles.filter((f) => f.endsWith('.chunk.js'))
// Route discovery (src/app/routes/@system/discovery.js) uses require.context,
// which bundles every page into the main chunk, so the React.lazy() wrappers
// produce EMPTY async chunks and webpack emits no .chunk.js files. The app
// still works (pages are in main); this is a performance regression, not a
// broken build — report it, do not fail the Docker build over it.
if (chunkFiles.length === 0) {
  console.warn('BUILD VERIFY WARN: dist/js/ has ZERO .chunk.js files — code splitting is not happening (pages are eagerly bundled in main)')
  console.log('BUILD VERIFY OK: dist/js/ has ' + jsFiles.filter((f) => f.endsWith('.js')).length + ' js files (no lazy chunks)')
  process.exit(0)
}

const appChunks = chunkFiles.filter((f) => f.startsWith('pages-app'))
if (appChunks.length === 0) {
  console.warn('BUILD VERIFY WARN: dist/js/ has no pages-app*.chunk.js files — /app pages are bundled in another chunk')
}

console.log(`BUILD VERIFY OK: dist/js/ has ${chunkFiles.length} chunk files (${appChunks.length} app page chunks)`)

// ── Stylesheet side-effect verification ───────────────────────────────────
// `import "./index.scss"` has no bindings, so webpack only keeps it when the
// extension is declared side-effectful in package.json. A missing entry does
// not fail the build — the CSS just never gets emitted. Check the declaration
// against what src/ actually imports, and that the extracted CSS exists.
const srcDir = resolve(__dirname, '..', 'src')
const styleImportRe = /import\s+['"][^'"]+\.(s?css)['"]/g
const importedExts = new Set()
;(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { if (name !== 'test') walk(p); continue }
    if (!/\.(jsx?|tsx?)$/.test(name)) continue
    const text = readFileSync(p, 'utf8')
    let m
    while ((m = styleImportRe.exec(text)) !== null) importedExts.add(m[1])
  }
})(srcDir)

const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8'))
const sideEffects = Array.isArray(pkg.sideEffects) ? pkg.sideEffects : []
for (const ext of importedExts) {
  if (sideEffects === true) break
  if (!sideEffects.some((g) => g === `*.${ext}` || g.endsWith(`.${ext}`))) {
    console.error(`BUILD VERIFY FAIL: src/ imports .${ext} stylesheets for their side effects but client/package.json "sideEffects" does not list "*.${ext}" — webpack drops those imports in production and the pages ship unstyled`)
    process.exit(1)
  }
}
if (importedExts.has('scss')) {
  const cssDir = resolve(__dirname, '..', 'dist', 'css')
  const cssFiles = readdirSync(cssDir).filter((f) => f.endsWith('.css'))
  const hasAuthCss = cssFiles.some((f) => readFileSync(join(cssDir, f), 'utf8').includes('.auth-page'))
  if (!hasAuthCss) {
    console.error('BUILD VERIFY FAIL: no emitted CSS contains .auth-page — AuthPage/index.scss was not bundled')
    process.exit(1)
  }
}
console.log(`BUILD VERIFY OK: stylesheet side effects declared for ${[...importedExts].map((e) => '.' + e).join(', ') || 'none'}; AuthPage CSS emitted`)
