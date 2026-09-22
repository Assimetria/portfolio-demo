'use strict'

/**
 * Migration 006 — Polar subscriptions table
 * Stores subscription data from Polar.sh (alternative to Stripe).
 * Mirrors the subscriptions table structure but uses Polar IDs.
 */

exports.up = async (db) => {
  await db.none(`
    CREATE TABLE IF NOT EXISTS polar_subscriptions (
      id                       SERIAL PRIMARY KEY,
      user_id                  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      polar_subscription_id    TEXT UNIQUE,
      polar_product_id         TEXT,
      polar_price_id           TEXT,
      status                   TEXT NOT NULL DEFAULT 'inactive',
      current_period_start     TIMESTAMPTZ,
      current_period_end       TIMESTAMPTZ,
      cancel_at_period_end     BOOLEAN NOT NULL DEFAULT false,
      created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_polar_subscriptions_user_id
      ON polar_subscriptions(user_id);

    CREATE INDEX IF NOT EXISTS idx_polar_subscriptions_polar_subscription_id
      ON polar_subscriptions(polar_subscription_id);
  `)
  console.log('[006_polar_subscriptions] applied')
}

exports.down = async (db) => {
  await db.none('DROP TABLE IF EXISTS polar_subscriptions CASCADE')
  console.log('[006_polar_subscriptions] rolled back')
}
