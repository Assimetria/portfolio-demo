#!/usr/bin/env node
/**
 * template-ownership.js — who owns which file when a customer app is upgraded
 * to a newer template version.
 *
 * The rules live in template-manifest.json under `ownership` (globs, relative to
 * the repo root) so a template release can change them without an Orkosi deploy:
 *
 *   {
 *     "system":   [...]   template-owned   → replaced by the template's version
 *     "custom":   [...]   product code     → never touched when the file exists
 *     "customer": [...]   customer data    → never touched when the file exists
 *     "merge":    [...]   everything else  → 3-way merge (base = template@from,
 *                                             ours = customer, theirs = template@to)
 *   }
 *
 * Precedence when several globs match: custom → customer → system → merge
 * (first category in that order wins). A file in a `custom`/`customer` category
 * that the customer does NOT have yet is still added on upgrade (new scaffold).
 *
 * Consumers: scripts/@system/upgrade-from-template.js (developer CLI) and the
 * Orkosi platform upgrade engine (backend/lib/template-versioning), which reads
 * the manifest at the TARGET tag and falls back to DEFAULT_OWNERSHIP.
 *
 * CLI:
 *   node scripts/@system/template-ownership.js classify <path> [...]   → "<category>\t<path>" per line
 *   node scripts/@system/template-ownership.js rules                   → effective rules as JSON
 */

const fs = require('fs')
const path = require('path')

const CATEGORIES = Object.freeze(['custom', 'customer', 'system', 'merge'])

const DEFAULT_OWNERSHIP = Object.freeze({
  system: [
    '**/@system/**',
    'scripts/apply-brand.js',
    'scripts/prebuild.js',
    'scripts/lib/**',
    'scripts/ci/**',
    'scripts/generate-*.js',
    'scripts/ensure-transparent-logo.js',
    'client/webpack.config.mjs',
    'client/tailwind.config.mjs',
    'client/postcss.config.*',
    'client/scripts/**',
    '.github/workflows/**',
    'Dockerfile',
    '.dockerignore',
    'start.sh',
    'buildspec-ci.yml',
    'buildspec-cd.yml',
    'docker-compose.yml',
    'docker-compose.local.yml',
    'template-manifest.json',
    'brand.schema.json',
    'VERSION',
  ],
  custom: ['**/@custom/**'],
  customer: [
    'brand.json',
    'assets/**',
    'client/public/**',
    'README.md',
    'CLAUDE.md',
    'DOCKER_CLAUDE.md',
    '.env',
    '.env.*',
    'server/.env',
    'server/.env.*',
    'client/.env',
    'client/.env.*',
  ],
  merge: ['**'],
})

/**
 * Convert a glob (supports double-star, star, ?, {a,b}) into a RegExp anchored on
 * the whole path. A leading "double-star slash" also matches zero directories, so
 * the @system glob matches both "@system/x" and "a/b/@system/x".
 */
function globToRegExp(glob) {
  let re = ''
  let i = 0
  const g = glob.replace(/^\.?\//, '')
  while (i < g.length) {
    const c = g[i]
    if (c === '*') {
      if (g[i + 1] === '*') {
        // `**/` → any number of directories (including none); trailing `**` → anything
        if (g[i + 2] === '/') {
          re += '(?:.*/)?'
          i += 3
        } else {
          re += '.*'
          i += 2
        }
      } else {
        re += '[^/]*'
        i += 1
      }
    } else if (c === '?') {
      re += '[^/]'
      i += 1
    } else if (c === '{') {
      const end = g.indexOf('}', i)
      if (end === -1) {
        re += '\\{'
        i += 1
      } else {
        const alts = g
          .slice(i + 1, end)
          .split(',')
          .map((a) => a.replace(/[.+^$()|[\]\\]/g, '\\$&'))
        re += `(?:${alts.join('|')})`
        i = end + 1
      }
    } else {
      re += c.replace(/[.+^$()|[\]\\]/g, '\\$&')
      i += 1
    }
  }
  return new RegExp(`^${re}$`)
}

function normalizePath(p) {
  return String(p).replace(/\\/g, '/').replace(/^\.?\//, '')
}

/** Merge manifest ownership with defaults: a category present in the manifest replaces the default list. */
function resolveOwnership(manifestOwnership) {
  const out = {}
  for (const cat of CATEGORIES) {
    const fromManifest = manifestOwnership && Array.isArray(manifestOwnership[cat]) ? manifestOwnership[cat] : null
    out[cat] = (fromManifest || DEFAULT_OWNERSHIP[cat]).map(String)
  }
  return out
}

function compileOwnership(ownership) {
  const resolved = resolveOwnership(ownership)
  return CATEGORIES.map((cat) => ({ cat, matchers: resolved[cat].map(globToRegExp) }))
}

/** Classify one repo-relative path → 'custom' | 'customer' | 'system' | 'merge'. */
function classify(relPath, compiled) {
  const p = normalizePath(relPath)
  const table = Array.isArray(compiled) ? compiled : compileOwnership(compiled)
  for (const { cat, matchers } of table) {
    if (matchers.some((m) => m.test(p))) return cat
  }
  return 'merge'
}

function loadManifestOwnership(root = process.cwd()) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'template-manifest.json'), 'utf8'))
    return manifest.ownership || null
  } catch (_) {
    return null
  }
}

module.exports = {
  CATEGORIES,
  DEFAULT_OWNERSHIP,
  globToRegExp,
  resolveOwnership,
  compileOwnership,
  classify,
  loadManifestOwnership,
}

if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2)
  const rootIdx = rest.indexOf('--root')
  const root = rootIdx !== -1 ? path.resolve(rest.splice(rootIdx, 2)[1]) : process.cwd()
  const rules = resolveOwnership(loadManifestOwnership(root))
  if (cmd === 'rules') {
    process.stdout.write(JSON.stringify(rules, null, 2) + '\n')
  } else if (cmd === 'classify') {
    const compiled = compileOwnership(rules)
    const paths = rest.length ? rest : fs.readFileSync(0, 'utf8').split('\n').filter(Boolean)
    for (const p of paths) process.stdout.write(`${classify(p, compiled)}\t${normalizePath(p)}\n`)
  } else {
    console.error('usage: template-ownership.js rules | classify <path>... [--root dir]')
    process.exit(2)
  }
}
