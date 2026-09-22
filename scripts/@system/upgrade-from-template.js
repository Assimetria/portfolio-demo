#!/usr/bin/env node
/**
 * upgrade-from-template.js — developer CLI that upgrades THIS product repo to a
 * newer version of the template it was generated from.
 *
 * Same rules as the Orkosi platform upgrade (backend/lib/template-versioning),
 * so what a developer runs locally and what the "Upgrade" button does agree:
 *
 *   from  = v<VERSION>            the template version this repo is on
 *   to    = --to vX.Y.Z | latest v* tag of template-manifest.json.templateRepo
 *   for every file that changed in the template between from..to, by ownership
 *   (scripts/@system/template-ownership.js, rules from the manifest at `to`):
 *     system    → take the template's file (or delete it if the template removed it)
 *     custom    → keep ours when the file exists; add it when we do not have it
 *     customer  → same as custom (brand.json, assets, README, .env…)
 *     merge     → 3-way merge: base = template@from, ours = working tree, theirs = template@to
 *                 (git merge-file); conflicts are left in the file with markers
 *
 * Customer repos are created with GitHub "create from template" and share no git
 * history with the template, so this never uses `git merge`; it works file by
 * file against the template's tags fetched into a `template` remote.
 *
 * Usage (run from anywhere inside the repo, clean working tree required):
 *   node scripts/@system/upgrade-from-template.js                 # to latest
 *   node scripts/@system/upgrade-from-template.js --to v2.3.0
 *   node scripts/@system/upgrade-from-template.js --dry-run       # plan only
 *   node scripts/@system/upgrade-from-template.js --no-commit     # stage, do not commit
 *   node scripts/@system/upgrade-from-template.js --json          # machine-readable result
 *
 * Exit codes: 0 upgraded (or nothing to do) · 2 conflicts left for review · 1 error
 */

const fs = require('fs')
const path = require('path')
const os = require('os')
const { execFileSync } = require('child_process')
const { compileOwnership, classify, resolveOwnership } = require('./template-ownership')
const { compareSemver, SEMVER_RE } = require('./version')

const REMOTE = 'template'

function git(root, args, opts = {}) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts })
}

function gitOk(root, args) {
  try {
    git(root, args)
    return true
  } catch (_) {
    return false
  }
}

function gitShow(root, ref, file) {
  try {
    return git(root, ['show', `${ref}:${file}`], { encoding: 'buffer' })
  } catch (_) {
    return null
  }
}

function parseArgs(argv) {
  const opts = { dryRun: false, commit: true, json: false, to: null, root: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') opts.dryRun = true
    else if (a === '--no-commit') opts.commit = false
    else if (a === '--json') opts.json = true
    else if (a === '--to') opts.to = argv[++i]
    else if (a === '--root') opts.root = argv[++i]
    else throw new Error(`unknown argument ${a}`)
  }
  return opts
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function readJsonAt(root, ref, file) {
  const buf = gitShow(root, ref, file)
  if (!buf) return null
  try {
    return JSON.parse(buf.toString('utf8'))
  } catch (_) {
    return null
  }
}

function ensureRemote(root, repo) {
  const url = `https://github.com/${repo}.git`
  if (!gitOk(root, ['remote', 'get-url', REMOTE])) git(root, ['remote', 'add', REMOTE, url])
  else if (git(root, ['remote', 'get-url', REMOTE]).trim() !== url) git(root, ['remote', 'set-url', REMOTE, url])
  git(root, ['fetch', '--quiet', '--tags', REMOTE])
}

function templateTags(root) {
  return git(root, ['tag', '-l', 'v*'])
    .split('\n')
    .map((t) => t.trim())
    .filter((t) => SEMVER_RE.test(t.slice(1)))
    .sort((a, b) => compareSemver(a.slice(1), b.slice(1)))
}

function mergeFile(oursBuf, baseBuf, theirsBuf) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl-merge-'))
  const ours = path.join(dir, 'ours')
  const base = path.join(dir, 'base')
  const theirs = path.join(dir, 'theirs')
  fs.writeFileSync(ours, oursBuf)
  fs.writeFileSync(base, baseBuf || Buffer.alloc(0))
  fs.writeFileSync(theirs, theirsBuf)
  try {
    const out = execFileSync('git', ['merge-file', '-p', '-L', 'ours', '-L', 'template-from', '-L', 'template-to', ours, base, theirs], {
      encoding: 'buffer',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return { content: out, conflict: false }
  } catch (err) {
    // exit status = number of conflicts (>0) or <0/255 on error
    if (typeof err.status === 'number' && err.status > 0 && err.status < 128) {
      return { content: err.stdout, conflict: true }
    }
    throw new Error(`git merge-file failed: ${err.message}`)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

function isBinary(buf) {
  if (!buf) return false
  const sample = buf.subarray(0, 8000)
  return sample.includes(0)
}

function writeFile(root, rel, buf) {
  const abs = path.join(root, rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, buf)
}

function plan(root, from, to, ownership) {
  const compiled = compileOwnership(ownership)
  const diff = git(root, ['diff', '--name-status', '--no-renames', from, to])
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, ...rest] = line.split('\t')
      return { status: status[0], file: rest.join('\t') }
    })
  return diff.map(({ status, file }) => {
    const category = classify(file, compiled)
    const existsLocally = fs.existsSync(path.join(root, file))
    const removedUpstream = status === 'D'
    let action
    if (category === 'system') action = removedUpstream ? 'delete' : 'take-template'
    else if (category === 'custom' || category === 'customer') {
      action = existsLocally ? 'keep-ours' : removedUpstream ? 'skip' : 'add-template'
    } else {
      // merge
      if (!existsLocally) action = removedUpstream ? 'skip' : 'add-template'
      else if (removedUpstream) action = 'keep-ours'
      else action = 'merge'
    }
    return { file, category, status, action }
  })
}

function apply(root, from, to, steps) {
  const conflicts = []
  const changed = []
  for (const step of steps) {
    const { file, action } = step
    if (action === 'skip' || action === 'keep-ours') continue
    if (action === 'delete') {
      if (fs.existsSync(path.join(root, file))) {
        fs.rmSync(path.join(root, file), { force: true })
        changed.push(file)
      }
      continue
    }
    const theirs = gitShow(root, to, file)
    if (theirs === null) continue
    if (action === 'take-template' || action === 'add-template') {
      writeFile(root, file, theirs)
      changed.push(file)
      continue
    }
    // merge
    const ours = fs.readFileSync(path.join(root, file))
    const base = gitShow(root, from, file)
    if (ours.equals(theirs)) continue
    if (isBinary(ours) || isBinary(theirs) || isBinary(base)) {
      // binaries cannot be 3-way merged: keep ours, report
      conflicts.push({ file, reason: 'binary' })
      continue
    }
    if (base && base.equals(ours)) {
      // we never touched it → take theirs
      writeFile(root, file, theirs)
      changed.push(file)
      continue
    }
    const { content, conflict } = mergeFile(ours, base, theirs)
    writeFile(root, file, content)
    changed.push(file)
    if (conflict) conflicts.push({ file, reason: 'conflict-markers' })
  }
  return { changed, conflicts }
}

function main(argv) {
  const opts = parseArgs(argv)
  const root = opts.root ? path.resolve(opts.root) : git(process.cwd(), ['rev-parse', '--show-toplevel']).trim()

  const manifestPath = path.join(root, 'template-manifest.json')
  if (!fs.existsSync(manifestPath)) throw new Error('template-manifest.json not found — is this a template-based repo?')
  const manifest = readJson(manifestPath)
  const repo = manifest.templateRepo
  if (!repo) throw new Error('template-manifest.json has no templateRepo — cannot locate the template')

  const current = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim()
  if (!SEMVER_RE.test(current)) throw new Error(`VERSION "${current}" is not X.Y.Z`)

  if (!opts.dryRun && git(root, ['status', '--porcelain']).trim()) {
    throw new Error('working tree is not clean — commit or stash first')
  }

  ensureRemote(root, repo)
  const tags = templateTags(root)
  const from = `v${current}`
  if (!tags.includes(from)) throw new Error(`template tag ${from} not found on ${repo} — cannot compute a base`)
  const to = opts.to ? (opts.to.startsWith('v') ? opts.to : `v${opts.to}`) : tags[tags.length - 1]
  if (!tags.includes(to)) throw new Error(`template tag ${to} not found on ${repo}`)

  const result = { repo, from, to, changed: [], conflicts: [], steps: [], committed: false }
  if (compareSemver(to.slice(1), current) <= 0) {
    result.upToDate = true
    if (opts.json) console.log(JSON.stringify(result, null, 2))
    else console.log(`[upgrade] already on ${from}; ${to} is not newer — nothing to do`)
    return 0
  }

  const targetManifest = readJsonAt(root, to, 'template-manifest.json') || {}
  const ownership = resolveOwnership(targetManifest.ownership)
  const steps = plan(root, from, to, ownership)
  result.steps = steps

  if (opts.dryRun) {
    if (opts.json) console.log(JSON.stringify(result, null, 2))
    else {
      console.log(`[upgrade] plan ${from} → ${to} (${steps.length} template changes)`)
      for (const s of steps) console.log(`  ${s.action.padEnd(14)} ${s.category.padEnd(8)} ${s.file}`)
    }
    return 0
  }

  const { changed, conflicts } = apply(root, from, to, steps)
  result.changed = changed
  result.conflicts = conflicts

  git(root, ['add', '--all'])
  if (conflicts.length === 0 && opts.commit && changed.length) {
    git(root, ['commit', '--quiet', '-m', `chore(template): upgrade ${from} → ${to}`, '-m', `Template ${repo} ${to}. Applied by scripts/@system/upgrade-from-template.js.`])
    result.committed = true
  }

  if (opts.json) console.log(JSON.stringify(result, null, 2))
  else {
    console.log(`[upgrade] ${from} → ${to}: ${changed.length} file(s) changed, ${conflicts.length} conflict(s)`)
    for (const c of conflicts) console.log(`  CONFLICT ${c.file} (${c.reason})`)
    if (conflicts.length) console.log('[upgrade] resolve the files above, then: git add -A && git commit')
    else if (result.committed) console.log('[upgrade] committed — run the test suite, then push')
  }
  return conflicts.length ? 2 : 0
}

module.exports = { plan, apply, mergeFile, templateTags }

if (require.main === module) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (err) {
    console.error(`[upgrade] ${err.message}`)
    process.exit(1)
  }
}
