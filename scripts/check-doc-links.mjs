#!/usr/bin/env node
// scripts/check-doc-links.mjs — fail when a Markdown file links to a path that
// does not exist in the repository.
//
// Scans every *.md under the repo root (skipping node_modules, .git and build
// output), extracts inline links `[text](target)` and reference definitions
// `[id]: target`, ignores external/mailto/anchor-only links and template
// placeholders, and resolves the rest relative to the file (or to the repo
// root when the target starts with "/"). Fenced and inline code are stripped
// first so example links in code blocks are not checked.
//
//   npm run docs:check            # whole repo
//   node scripts/check-doc-links.mjs docs/INDEX.md README.md   # specific files
//
// Exit 1 with one line per broken link; exit 0 when clean. No dependencies.
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  'playwright-report', 'test-results', 'backups', 'uploads',
])

async function walk(dir, out) {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) await walk(full, out)
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      out.push(full)
    }
  }
  return out
}

// Blank out fenced and inline code while keeping every newline, so reported
// line numbers stay accurate.
function stripCode(markdown) {
  const keepNewlines = (block) => block.replace(/[^\n]/g, ' ')
  return markdown
    .replace(/```[\s\S]*?```/g, keepNewlines)
    .replace(/~~~[\s\S]*?~~~/g, keepNewlines)
    .replace(/`[^`\n]*`/g, keepNewlines)
}

// Returns [{ target, line }] for every local link candidate in a file.
function extractLinks(markdown) {
  const links = []
  const text = stripCode(markdown)
  const inline = /!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g
  const reference = /^\s*\[[^\]]+\]:\s*<?(\S+)>?/gm
  for (const re of [inline, reference]) {
    let m
    while ((m = re.exec(text)) !== null) {
      const line = text.slice(0, m.index).split('\n').length
      links.push({ target: m[1], line })
    }
  }
  return links
}

function isExternal(target) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target) // http:, https:, mailto:, tel:, //cdn
}

async function exists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function checkFile(file) {
  const markdown = await fs.readFile(file, 'utf8')
  const broken = []
  for (const { target, line } of extractLinks(markdown)) {
    if (!target || target.startsWith('#') || isExternal(target)) continue
    if (target.includes('{{') || target.includes('${')) continue // template placeholders
    const clean = decodeURIComponent(target.split('#')[0].split('?')[0])
    if (!clean) continue
    const resolved = clean.startsWith('/')
      ? path.join(ROOT, clean)
      : path.resolve(path.dirname(file), clean)
    if (!(await exists(resolved))) broken.push({ target, line })
  }
  return broken
}

async function main() {
  const args = process.argv.slice(2)
  const files = args.length
    ? args.map((a) => path.resolve(ROOT, a))
    : await walk(ROOT, [])

  let brokenCount = 0
  let checked = 0
  for (const file of files.sort()) {
    checked += 1
    const broken = await checkFile(file)
    for (const { target, line } of broken) {
      brokenCount += 1
      console.error(`${path.relative(ROOT, file)}:${line}: broken link -> ${target}`)
    }
  }

  if (brokenCount > 0) {
    console.error(`\ndocs:check FAILED — ${brokenCount} broken link(s) in ${checked} file(s)`)
    process.exit(1)
  }
  console.log(`docs:check OK — ${checked} Markdown file(s), no broken relative links`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
