'use strict'

/**
 * Migration 005 — Email verification
 *
 * 1. Adds email_verified_at to users table (NULL = unverified)
 * 2. Creates email_verification_tokens table
 */

exports.up = async (db) => {
  await db.none(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
  `)

  await db.none(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id         SERIAL PRIMARY KEY,
      user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT NOT NULL UNIQUE,
      used_at    TIMESTAMPTZ,
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_evt_token   ON email_verification_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_evt_user_id ON email_verification_tokens(user_id);
  `)

  console.log('[005_email_verification] applied')
}

exports.down = async (db) => {
  await db.none('DROP TABLE IF EXISTS email_verification_tokens CASCADE')
  await db.none('ALTER TABLE users DROP COLUMN IF EXISTS email_verified_at')
  console.log('[005_email_verification] rolled back')
}
