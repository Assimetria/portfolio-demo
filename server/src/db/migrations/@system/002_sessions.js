'use strict'

/**
 * Migration 002 – Sessions table
 * Creates the sessions table for server-side session management.
 * Stores a hash of each issued token alongside metadata (user, IP, UA, expiry).
 * Supports revocation without requiring Redis.
 */

const fs = require('fs')
const path = require('path')

const SCHEMAS_DIR = path.join(__dirname, '../../schemas/@system')

exports.up = async (db) => {
  const sql = fs.readFileSync(path.join(SCHEMAS_DIR, 'sessions.sql'), 'utf8')
  await db.none(sql)
  console.log('[002_sessions] applied schema: sessions')
}

exports.down = async (db) => {
  await db.none('DROP TABLE IF EXISTS sessions CASCADE')
  console.log('[002_sessions] rolled back sessions table')
}
