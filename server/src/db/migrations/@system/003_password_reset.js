'use strict'

/**
 * Migration 003 — Password reset tokens table
 */

exports.up = async (db) => {
  await db.none(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         SERIAL PRIMARY KEY,
      user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT NOT NULL UNIQUE,
      used_at    TIMESTAMPTZ,
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 hour'),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_prt_token   ON password_reset_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_prt_user_id ON password_reset_tokens(user_id);
  `)
  console.log('[003_password_reset] applied')
}

exports.down = async (db) => {
  await db.none('DROP TABLE IF EXISTS password_reset_tokens CASCADE')
  console.log('[003_password_reset] rolled back')
}
