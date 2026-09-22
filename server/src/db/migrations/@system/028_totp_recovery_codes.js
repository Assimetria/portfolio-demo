'use strict'

/**
 * Migration 028 — TOTP recovery codes
 *
 * Creates a totp_recovery_codes table to store hashed backup codes that users
 * can use if they lose access to their authenticator device.
 *
 * Each code is stored as a SHA-256 hash to prevent plaintext exposure.
 */

exports.up = async (db) => {
  await db.none(`
    CREATE TABLE IF NOT EXISTS totp_recovery_codes (
      id         SERIAL PRIMARY KEY,
      user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash  VARCHAR(64) NOT NULL,
      used       BOOLEAN NOT NULL DEFAULT FALSE,
      used_at    TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_totp_recovery_user ON totp_recovery_codes(user_id);
    CREATE INDEX IF NOT EXISTS idx_totp_recovery_hash ON totp_recovery_codes(code_hash);
  `)

  console.log('[028_totp_recovery_codes] applied — totp_recovery_codes table created')
}

exports.down = async (db) => {
  await db.none('DROP TABLE IF EXISTS totp_recovery_codes CASCADE')
  console.log('[028_totp_recovery_codes] rolled back')
}
