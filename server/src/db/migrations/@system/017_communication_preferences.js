'use strict'

/**
 * Migration 010 – Communication Preferences
 * Creates the communication_preferences table for GDPR-compliant notification settings.
 */

const fs = require('fs')
const path = require('path')

const SCHEMAS_DIR = path.join(__dirname, '../../schemas/@system')

exports.up = async (db) => {
  const sqlPath = path.join(SCHEMAS_DIR, 'communication_preferences.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')
  await db.none(sql)
  console.log('[010_communication_preferences] ✓ communication_preferences table created')
}

exports.down = async (db) => {
  await db.none('DROP TABLE IF EXISTS communication_preferences CASCADE')
  console.log('[010_communication_preferences] ✗ communication_preferences table dropped')
}
