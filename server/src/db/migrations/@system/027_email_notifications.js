'use strict'

/**
 * Migration 027 – Email notification preferences
 * Adds email_notifications JSONB column to users table.
 * Stores per-user notification preferences (security, billing, activity, etc.).
 */

exports.up = async (db) => {
  await db.none(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS email_notifications JSONB DEFAULT '{"security":true,"billing":true,"activity":false,"marketing":false,"inApp":true,"weeklyDigest":false,"mentions":true}'
  `)
  console.log('[027_email_notifications] added email_notifications column to users table')
}

exports.down = async (db) => {
  await db.none(`
    ALTER TABLE users
      DROP COLUMN IF EXISTS email_notifications
  `)
  console.log('[027_email_notifications] removed email_notifications column from users table')
}
