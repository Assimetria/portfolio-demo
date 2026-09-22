'use strict'

/**
 * Migration 007 – Onboarding flow
 * Adds onboarding_completed + onboarding_completed_at columns to the users table.
 * These fields drive the first-time user wizard shown after registration.
 */

exports.up = async (db) => {
  await db.none(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS onboarding_completed     BOOLEAN     NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS onboarding_completed_at  TIMESTAMPTZ
  `)
  console.log('[007_onboarding] added onboarding columns to users table')
}

exports.down = async (db) => {
  await db.none(`
    ALTER TABLE users
      DROP COLUMN IF EXISTS onboarding_completed,
      DROP COLUMN IF EXISTS onboarding_completed_at
  `)
  console.log('[007_onboarding] removed onboarding columns from users table')
}
