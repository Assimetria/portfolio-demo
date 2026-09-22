'use strict'

/**
 * Migration 026 – Metrics, Threads & Messages
 * Creates tables for entity metrics tracking and AI chat threads/messages.
 */

const fs = require('fs')
const path = require('path')

const SCHEMAS_DIR = path.join(__dirname, '../../schemas/@system')

exports.up = async (db) => {
  const schemas = ['metrics', 'threads', 'messages']

  for (const schema of schemas) {
    const sqlPath = path.join(SCHEMAS_DIR, `${schema}.sql`)
    const sql = fs.readFileSync(sqlPath, 'utf8')
    await db.none(sql)
    console.log(`[026_metrics_threads_messages] applied schema: ${schema}`)
  }

  console.log('[026_metrics_threads_messages] ✓ metrics, threads, messages tables created')
}

exports.down = async (db) => {
  await db.none('DROP TABLE IF EXISTS messages CASCADE')
  await db.none('DROP TABLE IF EXISTS threads CASCADE')
  await db.none('DROP TABLE IF EXISTS metrics CASCADE')

  console.log('[026_metrics_threads_messages] ✗ metrics, threads, messages tables dropped')
}
