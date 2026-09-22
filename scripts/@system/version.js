#!/usr/bin/env node
/**
 * version.js — the template's single source of truth for its version.
 *
 * Four files must always agree; this script is the only thing that writes them:
 *   VERSION                  plain semver, read at runtime by /api/health and by Orkosi
 *   template-manifest.json   .version (+ .generatedAt)
 *   package.json             .version (root workspace)
 *   CHANGELOG.md             a "## vX.Y.Z (YYYY-MM-DD) — title" section per version
 *
 * Release flow (see docs/TEMPLATE-VERSIONING.md):
 *   node scripts/@system/version.js --bump minor --title "..." --notes-file notes.md
 *   commit → PR → merge to main → .github/workflows/release.yml tags vX.Y.Z and
 *   publishes the CHANGELOG section as the GitHub Release body → Orkosi shows
 *   "Version X.Y.Z available" to every customer app built from this template.
 *
 * Commands
 *   (none)                         print the current version
 *   --json                         machine-readable status of all four files
 *   --check                        exit 1 unless every file agrees and the contract keys exist (CI gate)
 *   --bump <patch|minor|major|X.Y.Z> [--title "…"] [--notes "md" | --notes-file f] [--date YYYY-MM-DD]
 *   --changelog [X.Y.Z]            print the CHANGELOG body for a version (release notes)
 *   --root <dir>                   operate on another checkout (tests, tooling)
 */

const fs = require('fs')
const path = require('path')

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const OWNERSHIP_KEYS = ['system', 'custom', 'customer', 'merge']

// ─── Changelog parsing ───────────────────────────────────────────────────────

/**
 * Parse a "## …" heading into { version, date, title } or null.
 * Accepted: "## v2.1.0 (2026-09-21) — Title", "## [2.1.0] - 2026-09-21", "## 2.1.0",
 * "## v2.0.0-shop (2026-09-20) — …" (pre-release suffix is dropped from `version`).
 */
function parseHeading(line) {
  const m = /^##\s+(.*?)\s*$/.exec(line)
  if (!m) return null
  let rest = m[1]
  const v = /^\[?v?(\d+\.\d+\.\d+)(?:-[0-9A-Za-z.-]+)?\]?/.exec(rest)
  if (!v) return null
  rest = rest.slice(v[0].length)
  let date = null
  const d = /(\d{4}-\d{2}-\d{2})/.exec(rest)
  if (d) {
    date = d[1]
    rest = rest.replace(d[0], '')
  }
  const title = rest
    .replace(/[()]/g, ' ')
    .replace(/^[\s—–:-]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return { version: v[1], date, title: title || null }
}

/** All sections of a CHANGELOG, newest first as written: [{ version, date, title, body }]. */
function parseChangelog(markdown) {
  const lines = String(markdown || '').split('\n')
  const sections = []
  let current = null
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current) sections.push(current)
      const h = parseHeading(line)
      current = h ? { ...h, bodyLines: [] } : { version: null, date: null, title: line.slice(3).trim(), bodyLines: [] }
      continue
    }
    if (current) current.bodyLines.push(line)
  }
  if (current) sections.push(current)
  return sections.map(({ bodyLines, ...s }) => ({ ...s, body: bodyLines.join('\n').trim() }))
}

function changelogSection(markdown, version) {
  return parseChangelog(markdown).find((s) => s.version === version) || null
}

// ─── Files ───────────────────────────────────────────────────────────────────

function files(root) {
  return {
    version: path.join(root, 'VERSION'),
    manifest: path.join(root, 'template-manifest.json'),
    pkg: path.join(root, 'package.json'),
    changelog: path.join(root, 'CHANGELOG.md'),
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function readStatus(root) {
  const f = files(root)
  const version = fs.existsSync(f.version) ? fs.readFileSync(f.version, 'utf8').trim() : null
  const manifest = fs.existsSync(f.manifest) ? readJson(f.manifest) : null
  const pkg = fs.existsSync(f.pkg) ? readJson(f.pkg) : null
  const changelogText = fs.existsSync(f.changelog) ? fs.readFileSync(f.changelog, 'utf8') : ''
  const sections = parseChangelog(changelogText)
  return {
    version,
    manifestVersion: manifest ? manifest.version || null : null,
    packageVersion: pkg ? pkg.version || null : null,
    changelogSection: version ? sections.find((s) => s.version === version) || null : null,
    latestChangelog: sections.find((s) => s.version) || null,
    templateSlug: manifest ? manifest.templateSlug || null : null,
    templateRepo: manifest ? manifest.templateRepo || null : null,
    ownership: manifest ? manifest.ownership || null : null,
  }
}

/** Contract violations as human-readable strings (empty = OK). */
function check(root) {
  const s = readStatus(root)
  const problems = []
  if (!s.version) problems.push('VERSION file missing or empty')
  else if (!SEMVER_RE.test(s.version)) problems.push(`VERSION "${s.version}" is not X.Y.Z`)
  if (s.manifestVersion !== s.version) {
    problems.push(`template-manifest.json version "${s.manifestVersion}" ≠ VERSION "${s.version}"`)
  }
  if (s.packageVersion !== s.version) problems.push(`package.json version "${s.packageVersion}" ≠ VERSION "${s.version}"`)
  if (s.version && !s.changelogSection) problems.push(`CHANGELOG.md has no "## v${s.version}" section`)
  if (!s.templateSlug || typeof s.templateSlug !== 'string') problems.push('template-manifest.json templateSlug missing')
  if (!s.templateRepo || !REPO_RE.test(s.templateRepo)) {
    problems.push(`template-manifest.json templateRepo "${s.templateRepo}" is not "owner/repo"`)
  }
  if (!s.ownership || typeof s.ownership !== 'object') {
    problems.push('template-manifest.json ownership block missing')
  } else {
    for (const k of OWNERSHIP_KEYS) {
      const globs = s.ownership[k]
      if (!Array.isArray(globs) || globs.length === 0 || !globs.every((g) => typeof g === 'string' && g.trim())) {
        problems.push(`template-manifest.json ownership.${k} must be a non-empty string array`)
      }
    }
    for (const k of Object.keys(s.ownership)) {
      if (!OWNERSHIP_KEYS.includes(k)) problems.push(`template-manifest.json ownership.${k} is not one of ${OWNERSHIP_KEYS.join('/')}`)
    }
  }
  return { status: s, problems }
}

// ─── Bump ────────────────────────────────────────────────────────────────────

function compareSemver(a, b) {
  const pa = String(a).split('.').map(Number)
  const pb = String(b).split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0) ? -1 : 1
  }
  return 0
}

function nextVersion(current, spec) {
  if (SEMVER_RE.test(spec)) {
    if (compareSemver(spec, current) <= 0) throw new Error(`target ${spec} must be greater than current ${current}`)
    return spec
  }
  const m = SEMVER_RE.exec(current)
  if (!m) throw new Error(`current VERSION "${current}" is not X.Y.Z`)
  const [maj, min, pat] = m.slice(1).map(Number)
  if (spec === 'major') return `${maj + 1}.0.0`
  if (spec === 'minor') return `${maj}.${min + 1}.0`
  if (spec === 'patch') return `${maj}.${min}.${pat + 1}`
  throw new Error(`bump must be patch|minor|major|X.Y.Z, got "${spec}"`)
}

function insertChangelogSection(markdown, { version, date, title, notes }) {
  const heading = `## v${version} (${date})${title ? ` — ${title}` : ''}`
  const block = `${heading}\n\n${(notes || '').trim() || '- No notes.'}\n\n`
  const text = String(markdown || '')
  if (!text.trim()) return `# Template Changelog\n\n${block}`
  const idx = text.search(/^## /m)
  if (idx === -1) return text.replace(/\s*$/, '\n\n') + block
  return text.slice(0, idx) + block + text.slice(idx)
}

function bump(root, spec, { title = '', notes = '', date } = {}) {
  const f = files(root)
  const s = readStatus(root)
  if (!s.version) throw new Error('VERSION file missing — cannot bump')
  const version = nextVersion(s.version, spec)
  const today = date || new Date().toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error(`--date must be YYYY-MM-DD, got "${today}"`)

  fs.writeFileSync(f.version, `${version}\n`)

  const manifest = readJson(f.manifest)
  manifest.version = version
  manifest.generatedAt = today
  fs.writeFileSync(f.manifest, JSON.stringify(manifest, null, 2) + '\n')

  const pkg = readJson(f.pkg)
  pkg.version = version
  fs.writeFileSync(f.pkg, JSON.stringify(pkg, null, 2) + '\n')

  const changelog = fs.existsSync(f.changelog) ? fs.readFileSync(f.changelog, 'utf8') : ''
  fs.writeFileSync(f.changelog, insertChangelogSection(changelog, { version, date: today, title, notes }))

  return { from: s.version, to: version, date: today }
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (['root', 'bump', 'title', 'notes', 'notes-file', 'date'].includes(key)) {
        opts[key] = next
        i++
      } else if (key === 'changelog') {
        opts.changelog = next && !next.startsWith('--') ? argv[++i] : true
      } else {
        opts[key] = true
      }
    } else {
      opts._.push(a)
    }
  }
  return opts
}

function main(argv) {
  const opts = parseArgs(argv)
  const root = opts.root ? path.resolve(opts.root) : path.resolve(__dirname, '..', '..')

  if (opts.bump) {
    const notes = opts['notes-file'] ? fs.readFileSync(path.resolve(opts['notes-file']), 'utf8') : opts.notes || ''
    const r = bump(root, opts.bump, { title: opts.title || '', notes, date: opts.date })
    console.log(`[version] ${r.from} → ${r.to} (${r.date}) — VERSION, template-manifest.json, package.json, CHANGELOG.md updated`)
    return 0
  }
  if (opts.changelog) {
    const s = readStatus(root)
    const version = opts.changelog === true ? s.version : opts.changelog
    const section = changelogSection(fs.readFileSync(files(root).changelog, 'utf8'), version)
    if (!section) {
      console.error(`[version] CHANGELOG.md has no section for v${version}`)
      return 1
    }
    process.stdout.write(section.body + '\n')
    return 0
  }
  if (opts.check) {
    const { status, problems } = check(root)
    if (problems.length) {
      console.error(`[version] contract violated (${problems.length}):`)
      for (const p of problems) console.error(`  - ${p}`)
      return 1
    }
    console.log(`[version] OK v${status.version} · ${status.templateSlug} · ${status.templateRepo}`)
    return 0
  }
  if (opts.json) {
    const { status, problems } = check(root)
    const { changelogSection: section, latestChangelog, ...rest } = status
    process.stdout.write(
      JSON.stringify(
        {
          ...rest,
          changelog: section ? { version: section.version, date: section.date, title: section.title } : null,
          latestChangelog: latestChangelog ? { version: latestChangelog.version, date: latestChangelog.date } : null,
          ok: problems.length === 0,
          problems,
        },
        null,
        2,
      ) + '\n',
    )
    return 0
  }
  const s = readStatus(root)
  if (!s.version) {
    console.error('[version] VERSION file missing')
    return 1
  }
  process.stdout.write(s.version + '\n')
  return 0
}

module.exports = {
  SEMVER_RE,
  parseHeading,
  parseChangelog,
  changelogSection,
  insertChangelogSection,
  readStatus,
  check,
  compareSemver,
  nextVersion,
  bump,
}

if (require.main === module) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (err) {
    console.error(`[version] ${err.message}`)
    process.exit(1)
  }
}
