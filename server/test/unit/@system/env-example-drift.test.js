// Drift test: every environment variable the code reads must be documented in
// the root .env.example (the complete operator reference), and the minimal
// local starter server/.env.example must stay a subset of it.
//
// Direction is code → example only: documenting a key the code does not read
// (yet) is fine and expected for variables another branch is introducing.
//
// Scanned: server/src/** and scripts/** (.js/.mjs/.cjs, node_modules excluded).
// Patterns: process.env.FOO, process.env['FOO'], process.env["FOO"],
//           const { FOO, BAR } = process.env

'use strict'

const fs = require('fs')
const path = require('path')

const REPO_ROOT = path.resolve(__dirname, '../../../..')
const SCAN_DIRS = ['server/src', 'scripts']
const ROOT_EXAMPLE = path.join(REPO_ROOT, '.env.example')
const SERVER_EXAMPLE = path.join(REPO_ROOT, 'server/.env.example')

// Variables the runtime/CI platform sets, never an operator. Keep this short —
// anything an operator could plausibly need to set belongs in .env.example.
const ALLOW_EXACT = new Set([
  'CI',
  'HOME',
  'PATH',
  'PWD',
  'TMPDIR',
  'USER',
  'SHELL',
  'TERM',
  'FORCE_COLOR',
  'NO_COLOR',
])
const ALLOW_PREFIX = ['GITHUB_', 'CODEBUILD_', 'RUNNER_', 'npm_', 'JEST_', 'PLAYWRIGHT_']

function isAllowListed(key) {
  return ALLOW_EXACT.has(key) || ALLOW_PREFIX.some((p) => key.startsWith(p))
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.(js|mjs|cjs)$/.test(entry.name)) out.push(full)
  }
  return out
}

/** @returns {Map<string, Set<string>>} key → set of relative files reading it */
function envKeysReadByCode() {
  const found = new Map()
  const record = (key, file) => {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) return
    if (!found.has(key)) found.set(key, new Set())
    found.get(key).add(path.relative(REPO_ROOT, file))
  }

  for (const dir of SCAN_DIRS) {
    const abs = path.join(REPO_ROOT, dir)
    if (!fs.existsSync(abs)) continue
    for (const file of walk(abs)) {
      const src = fs.readFileSync(file, 'utf8')
      for (const m of src.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)) record(m[1], file)
      for (const m of src.matchAll(/process\.env\[\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\]/g)) record(m[1], file)
      for (const m of src.matchAll(/\{([^{}]*)\}\s*=\s*process\.env\b/g)) {
        for (const part of m[1].split(',')) {
          const name = part.split(':')[0].split('=')[0].trim()
          if (name) record(name, file)
        }
      }
    }
  }
  return found
}

/** Keys declared in an env example file — commented-out lines count as documented. */
function envKeysDocumented(file) {
  const keys = new Set()
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*#?\s*([A-Z][A-Z0-9_]*)=/)
    if (m) keys.add(m[1])
  }
  return keys
}

describe('.env.example documents every environment variable the code reads', () => {
  const codeKeys = envKeysReadByCode()
  const documented = envKeysDocumented(ROOT_EXAMPLE)

  it('scans a meaningful amount of code (sanity check on the scanner itself)', () => {
    expect(codeKeys.size).toBeGreaterThan(50)
    expect(documented.size).toBeGreaterThan(50)
    // Spot-checks: destructured + dotted reads are both picked up
    expect(codeKeys.has('DATABASE_URL')).toBe(true)
    expect(codeKeys.has('PGHOST')).toBe(true)
  })

  it('has no undocumented keys (code → .env.example)', () => {
    const missing = [...codeKeys.keys()]
      .filter((k) => !documented.has(k) && !isAllowListed(k))
      .sort()
      .map((k) => `${k}  (read in: ${[...codeKeys.get(k)].slice(0, 3).join(', ')})`)

    if (missing.length) {
      throw new Error(
        `${missing.length} environment variable(s) read by code are not documented in .env.example ` +
        `(a commented-out "# KEY=" line is enough):\n  ${missing.join('\n  ')}`
      )
    }
  })

  it('keeps the allow-list honest: every allow-listed exact key is actually undocumented', () => {
    // If a key is documented it does not need to be allow-listed — remove it.
    const redundant = [...ALLOW_EXACT].filter((k) => documented.has(k))
    expect(redundant).toEqual([])
  })
})

describe('server/.env.example (local starter) stays a subset of the root reference', () => {
  it('declares no key the root .env.example lacks', () => {
    const root = envKeysDocumented(ROOT_EXAMPLE)
    const starter = envKeysDocumented(SERVER_EXAMPLE)
    const extra = [...starter].filter((k) => !root.has(k)).sort()
    if (extra.length) {
      throw new Error(`server/.env.example declares keys the root .env.example lacks — document them there too:\n  ${extra.join('\n  ')}`)
    }
  })
})
