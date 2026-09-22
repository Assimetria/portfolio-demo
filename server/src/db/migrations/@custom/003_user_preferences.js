'use strict'

/**
 * @custom — Migration 003: user preferences (JSONB)
 *
 * Adds a `preferences` JSONB column to the `users` table so theme, language,
 * timezone, date format, compact-mode toggle, and sidebar state are persisted
 * server-side. The column defaults to an empty JSON object.
 *
 * This migration also updates the `toPublicUser` helper (in auth.js) to include
 * the preferences field in every session /me response so the client can restore
 * user-specific defaults across browsers/devices.
 */

exports.up = async (db) => {
  await db.none(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb
  `)
  console.log('[003_user_preferences] added preferences JSONB column to users')
}

exports.down = async (db) => {
  await db.none('ALTER TABLE users DROP COLUMN IF EXISTS preferences')
  console.log('[003_user_preferences] rolled back — removed preferences column')
}