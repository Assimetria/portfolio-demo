'use strict'

/**
 * Migration 024 — API key scoped permissions + usage tracking
 * Adds:
 *   - scopes column on api_keys (JSONB array of permission strings)
 *   - request_count column on api_keys (rolling usage counter)
 *   - rate_limit column on api_keys (per-key requests/minute override)
 *   - api_key_usage table for granular usage history
 */

exports.up = async (db) => {
  await db.none(`
    ALTER TABLE api_keys
      ADD COLUMN IF NOT EXISTS scopes      JSONB DEFAULT '["*"]'::jsonb,
      ADD COLUMN IF NOT EXISTS request_count BIGINT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS rate_limit   INT;

    CREATE TABLE IF NOT EXISTS api_key_usage (
      id         SERIAL PRIMARY KEY,
      api_key_id INT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
      endpoint   TEXT NOT NULL,
      method     TEXT NOT NULL,
      status     INT,
      ip         TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_api_key_usage_key_id ON api_key_usage(api_key_id);
    CREATE INDEX IF NOT EXISTS idx_api_key_usage_created ON api_key_usage(created_at);
  `)
  console.log('[024_api_key_enhancements] applied')
}

exports.down = async (db) => {
  await db.none(`
    DROP TABLE IF EXISTS api_key_usage CASCADE;
    ALTER TABLE api_keys
      DROP COLUMN IF EXISTS scopes,
      DROP COLUMN IF EXISTS request_count,
      DROP COLUMN IF EXISTS rate_limit;
  `)
  console.log('[024_api_key_enhancements] rolled back')
}
