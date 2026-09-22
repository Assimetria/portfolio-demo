'use strict'

/**
 * Migration 007 — Stripe subscriptions table
 * Stores subscription data from Stripe payments.
 * Tracks active/inactive subscriptions, billing periods, and cancellation state.
 */

exports.up = async (db) => {
  await db.none(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id                       SERIAL PRIMARY KEY,
      user_id                  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stripe_subscription_id   TEXT UNIQUE,
      stripe_customer_id       TEXT,
      stripe_price_id          TEXT,
      status                   TEXT NOT NULL DEFAULT 'inactive',
      current_period_start     TIMESTAMPTZ,
      current_period_end       TIMESTAMPTZ,
      cancel_at_period_end     BOOLEAN NOT NULL DEFAULT false,
      created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
      ON subscriptions(user_id);

    CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id
      ON subscriptions(stripe_subscription_id);

    CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id
      ON subscriptions(stripe_customer_id);

    CREATE INDEX IF NOT EXISTS idx_subscriptions_status
      ON subscriptions(status);
  `)
  console.log('[007_stripe_subscriptions] applied')
}

exports.down = async (db) => {
  await db.none('DROP TABLE IF EXISTS subscriptions CASCADE')
  console.log('[007_stripe_subscriptions] rolled back')
}
