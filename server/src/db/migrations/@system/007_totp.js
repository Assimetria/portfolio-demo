'use strict'

/**
 * Migration 004 — TOTP / 2FA support
 *
 * Adds two columns to the users table:
 *   totp_secret  — encrypted TOTP secret (base32); NULL when 2FA is not configured
 *   totp_enabled — whether 2FA is active; user must verify a code before it is set true
 *
 * Also creates a totp_pending_secrets table that stores unconfirmed secrets
 * while the user is mid-setup (before they have scanned + verified their code).
 */

exports.up = async (db) => {
  await db.none(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS totp_secret  TEXT,
      ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
  `)

  await db.none(`
    CREATE TABLE IF NOT EXISTS totp_pending_secrets (
      id         SERIAL PRIMARY KEY,
      user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      secret     TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
      UNIQUE(user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_totp_pending_user ON totp_pending_secrets(user_id);
  `)

  console.log('[004_totp] applied — totp_secret/totp_enabled columns + totp_pending_secrets table')
}

exports.down = async (db) => {
  await db.none('DROP TABLE IF EXISTS totp_pending_secrets CASCADE')
  await db.none('ALTER TABLE users DROP COLUMN IF EXISTS totp_enabled')
  await db.none('ALTER TABLE users DROP COLUMN IF EXISTS totp_secret')
  console.log('[004_totp] rolled back')
}
