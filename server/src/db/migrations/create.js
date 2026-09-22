#!/usr/bin/env node
'use strict'

/**
 * Migration scaffold generator
 *
 * Creates a new migration file with up() and down() stubs.
 * Files are placed in db/migrations/@custom/ by default,
 * or db/migrations/@system/ with --system flag.
 *
 * Usage:
 *   node src/db/migrations/create.js <name>             # creates @custom migration
 *   node src/db/migrations/create.js <name> --system   # creates @system migration
 *
 * Examples:
 *   node src/db/migrations/create.js add_stripe_price_id
 *   npm run migrate:create add_stripe_price_id
 *   npm run migrate:create -- add_stripe_price_id --system
 *
 * The generated file will be named: NNN_<name>.js
 * where NNN is the next available 3-digit sequence number.
 */

const fs = require('fs')
const path = require('path')

const SYSTEM_DIR = path.join(__dirname, '@system')
const CUSTOM_DIR = path.join(__dirname, '@custom')

const EXCLUDED = new Set(['run.js', 'index.js', 'create.js'])

function log(msg) { console.log(`[migrate:create] ${msg}`) }
function die(msg) { console.error(`[migrate:create] ERROR: ${msg}`); process.exit(1) }

/** Find the highest NNN prefix in use across both dirs, return next as zero-padded string. */
function nextSequenceNumber(dir) {
  if (!fs.existsSync(dir)) return '001'

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.js') && !EXCLUDED.has(f))

  let max = 0
  for (const f of files) {
    const m = f.match(/^(\d+)_/)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }

  return String(max + 1).padStart(3, '0')
}

/** Slugify the name: lowercase, replace spaces/dashes with underscores, strip non-alphanum. */
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

function generateTemplate(fileName, description) {
  return `'use strict'

/**
 * Migration – ${description}
 *
 * Implement up() to apply schema changes, down() to revert them.
 */

exports.up = async (db) => {
  // Apply your schema changes here
  // await db.none(\`CREATE TABLE IF NOT EXISTS ...\`)
  console.log('[${fileName}] applied')
}

exports.down = async (db) => {
  // Revert your schema changes here
  // await db.none('DROP TABLE IF EXISTS ... CASCADE')
  console.log('[${fileName}] rolled back')
}
`
}

function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args[0].startsWith('--')) {
    die('Usage: create.js <migration-name> [--system]\n  e.g. create.js add_stripe_price_id')
  }

  const nameArg = args[0]
  const isSystem = args.includes('--system')

  const targetDir = isSystem ? SYSTEM_DIR : CUSTOM_DIR
  const label = isSystem ? '@system' : '@custom'

  const slug = slugify(nameArg)
  if (!slug) die(`Invalid migration name: "${nameArg}"`)

  const seq = nextSequenceNumber(targetDir)
  const fileName = `${seq}_${slug}.js`
  const filePath = path.join(targetDir, fileName)

  if (fs.existsSync(filePath)) {
    die(`File already exists: ${filePath}`)
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }

  const content = generateTemplate(fileName.replace('.js', ''), slug.replace(/_/g, ' '))
  fs.writeFileSync(filePath, content, 'utf8')

  log(`Created ${label} migration: ${filePath}`)
  log(`Next step: implement up() and down() in ${fileName}`)
}

main()
