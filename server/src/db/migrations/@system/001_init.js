'use strict'

/**
 * Migration 001 – Initial schema
 * Creates the core users and subscriptions tables.
 */

const fs = require('fs')
const path = require('path')

const SCHEMAS_DIR = path.join(__dirname, '../../schemas/@system')

exports.up = async (db) => {
  const schemas = ['users', 'subscriptions']
  for (const schema of schemas) {
    const sql = fs.readFileSync(path.join(SCHEMAS_DIR, `${schema}.sql`), 'utf8')
    await db.none(sql)
    console.log(`[001_init] applied schema: ${schema}`)
  }
}

exports.down = async (db) => {
  await db.none('DROP TABLE IF EXISTS subscriptions CASCADE')
  await db.none('DROP TABLE IF EXISTS users CASCADE')
  console.log('[001_init] rolled back initial schema')
}
