'use strict'

/**
 * Migration 004 — Refresh tokens table
 * Supports refresh token rotation with family-based reuse detection.
 */

const fs = require('fs')
const path = require('path')

const SCHEMAS_DIR = path.join(__dirname, '../../schemas/@system')

exports.up = async (db) => {
  const sql = fs.readFileSync(path.join(SCHEMAS_DIR, 'refresh_tokens.sql'), 'utf8')
  await db.none(sql)
  console.log('[004_refresh_tokens] applied schema: refresh_tokens')
}

exports.down = async (db) => {
  await db.none('DROP TABLE IF EXISTS refresh_tokens CASCADE')
  console.log('[004_refresh_tokens] rolled back refresh_tokens table')
}
