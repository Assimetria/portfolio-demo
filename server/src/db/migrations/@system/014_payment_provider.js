// @system — Migration 008: add payment_provider column to subscriptions + polar_subscriptions
// Tracks which payment provider created each subscription row.
// Default 'stripe' for existing rows in subscriptions; 'polar' for polar_subscriptions.

'use strict'

exports.up = async (db) => {
  await db.none(`
    -- Add provider column to subscriptions (Stripe)
    ALTER TABLE subscriptions
      ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'stripe';

    -- Add provider column to polar_subscriptions
    ALTER TABLE polar_subscriptions
      ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'polar';

    -- Index for filtering by provider
    CREATE INDEX IF NOT EXISTS idx_subscriptions_payment_provider
      ON subscriptions(payment_provider);

    CREATE INDEX IF NOT EXISTS idx_polar_subscriptions_payment_provider
      ON polar_subscriptions(payment_provider);
  `)
  console.log('[008_payment_provider] applied')
}

exports.down = async (db) => {
  await db.none(`
    DROP INDEX IF EXISTS idx_subscriptions_payment_provider;
    DROP INDEX IF EXISTS idx_polar_subscriptions_payment_provider;
    ALTER TABLE subscriptions      DROP COLUMN IF EXISTS payment_provider;
    ALTER TABLE polar_subscriptions DROP COLUMN IF EXISTS payment_provider;
  `)
  console.log('[008_payment_provider] rolled back')
}
