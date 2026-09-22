'use strict'

/**
 * Migration 025 — User-facing webhook management
 * Users can register webhook endpoints to receive event notifications.
 * Tracks webhook deliveries for debugging.
 */

exports.up = async (db) => {
  await db.none(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id          SERIAL PRIMARY KEY,
      user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      url         TEXT NOT NULL,
      events      JSONB NOT NULL DEFAULT '[]'::jsonb,
      secret      TEXT NOT NULL,
      description TEXT,
      active      BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);
    CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(active) WHERE active = true;

    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id          SERIAL PRIMARY KEY,
      webhook_id  INT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
      event       TEXT NOT NULL,
      payload     JSONB,
      status      INT,
      response    TEXT,
      duration_ms INT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
    CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created ON webhook_deliveries(created_at);
  `)
  console.log('[025_webhooks] applied')
}

exports.down = async (db) => {
  await db.none(`
    DROP TABLE IF EXISTS webhook_deliveries CASCADE;
    DROP TABLE IF EXISTS webhooks CASCADE;
  `)
  console.log('[025_webhooks] rolled back')
}
