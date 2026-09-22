'use strict'

/**
 * Migration 016 – SaaS Core Features
 * Creates tables for email logs, file uploads, and audit logs.
 * 
 * These tables support the core SaaS features:
 * - Email tracking and analytics
 * - File upload management  
 * - Audit trails for compliance
 */

const fs = require('fs')
const path = require('path')

const SCHEMAS_DIR = path.join(__dirname, '../../schemas/@system')

exports.up = async (db) => {
  const schemas = ['email_logs', 'file_uploads', 'audit_logs']
  
  for (const schema of schemas) {
    const sqlPath = path.join(SCHEMAS_DIR, `${schema}.sql`)
    const sql = fs.readFileSync(sqlPath, 'utf8')
    await db.none(sql)
    console.log(`[016_saas_core_features] applied schema: ${schema}`)
  }
  
  console.log('[016_saas_core_features] ✓ SaaS core features tables created')
}

exports.down = async (db) => {
  // Drop tables in reverse order to handle dependencies
  await db.none('DROP TABLE IF EXISTS audit_logs CASCADE')
  await db.none('DROP TABLE IF EXISTS file_uploads CASCADE')
  await db.none('DROP TABLE IF EXISTS email_logs CASCADE')
  
  console.log('[016_saas_core_features] ✗ SaaS core features tables dropped')
}
