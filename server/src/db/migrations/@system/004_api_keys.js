'use strict'

/**
 * Migration 004 — API keys table
 * Stores hashed API keys for programmatic access.
 * The raw key is only returned once at creation time; only the hash is stored.
 */

exports.up = async (db) => {
  await db.none(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id           SERIAL PRIMARY KEY,
      user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name         TEXT NOT NULL,
      key_hash     TEXT NOT NULL UNIQUE,
      key_prefix   TEXT NOT NULL,
      last_used_at TIMESTAMPTZ,
      expires_at   TIMESTAMPTZ,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_api_keys_user_id  ON api_keys(user_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
  `)
  console.log('[004_api_keys] applied')
}

exports.down = async (db) => {
  await db.none('DROP TABLE IF EXISTS api_keys CASCADE')
  console.log('[004_api_keys] rolled back')
}
