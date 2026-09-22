'use strict'

/**
 * Migration 004 — OAuth accounts
 *
 * - Makes users.password_hash nullable (OAuth users have no password)
 * - Creates oauth_accounts table to store provider-linked identities
 */

exports.up = async (db) => {
  await db.none(`
    -- Allow OAuth users who have no password
    ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

    -- OAuth provider accounts linked to users
    CREATE TABLE IF NOT EXISTS oauth_accounts (
      id          SERIAL PRIMARY KEY,
      user_id     INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider    TEXT NOT NULL,   -- 'google' | 'github'
      provider_id TEXT NOT NULL,   -- provider's unique user ID
      email       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (provider, provider_id)
    );

    CREATE INDEX IF NOT EXISTS idx_oauth_user_id ON oauth_accounts(user_id);
  `)
  console.log('[004_oauth_accounts] applied')
}

exports.down = async (db) => {
  await db.none(`
    DROP TABLE IF EXISTS oauth_accounts CASCADE;
    ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
  `)
  console.log('[004_oauth_accounts] rolled back')
}
