'use strict'

/**
 * @custom — Migration 002: user profile fields + owning-subscription attribution
 *
 * Adds missing profile/user fields to the @system `users` table and a pointer to
 * the user's owning subscription (`subscription_id`) so subscription + UTM
 * attribution can be resolved off the user record directly.
 *
 *   - avatar_url         TEXT
 *   - display_name       TEXT
 *   - locale             TEXT NOT NULL DEFAULT 'en'
 *   - timezone           TEXT
 *   - phone              TEXT
 *   - marketing_opt_in   BOOLEAN NOT NULL DEFAULT false
 *   - last_seen_at       TIMESTAMPTZ
 *   - subscription_id    INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL
 *   - idx_users_subscription_id
 *
 * UTM tracking lives on the owning row in `subscriptions` (utm_source / referrer,
 * added by billing migration 013). The backfill below points each user at their
 * latest `active`/`trialing` subscription so the UTM attribution is reachable from
 * the user without a separate join cost.
 *
 * All DDL uses IF [NOT] EXISTS guards so applying the migration more than once is
 * a no-op (matching the convention used by @system migrations 007_onboarding and
 * 019_brands_full_system_upgrade).
 */

exports.up = async (db) => {
  // ── 1. Add profile fields + owning subscription pointer (idempotent) ───────
  await db.none(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS avatar_url        TEXT,
      ADD COLUMN IF NOT EXISTS display_name      TEXT,
      ADD COLUMN IF NOT EXISTS locale            TEXT NOT NULL DEFAULT 'en',
      ADD COLUMN IF NOT EXISTS timezone          TEXT,
      ADD COLUMN IF NOT EXISTS phone             TEXT,
      ADD COLUMN IF NOT EXISTS marketing_opt_in  BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS last_seen_at      TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS subscription_id   INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL
  `)
  console.log('[002_user_fields_subscription_attribution] added profile columns + subscription_id to users')

  // ── 2. Index the owning-subscription pointer ────────────────────────────────
  await db.none('CREATE INDEX IF NOT EXISTS idx_users_subscription_id ON users(subscription_id)')
  console.log('[002_user_fields_subscription_attribution] created idx_users_subscription_id')

  // ── 3. Backfill subscription_id from the owning subscription ───────────────
  // For each user pick the latest `active`/`trialing` subscription by its period
  // end. Users without such a subscription stay NULL (soft ownerless fallback).
  await db.none(`
    UPDATE users u
       SET subscription_id = o.subscription_id
      FROM (
        SELECT DISTINCT ON (s.user_id)
               s.user_id, s.id AS subscription_id
          FROM subscriptions s
         WHERE s.status IN ('active', 'trialing')
         ORDER BY s.user_id, s.current_period_end DESC NULLS LAST
      ) o
     WHERE u.id = o.user_id
  `)
  console.log('[002_user_fields_subscription_attribution] backfilled users.subscription_id from owning subscriptions')
}

exports.down = async (db) => {
  // Reverse in the opposite order of `up`: index → pointer → profile fields.
  await db.none('DROP INDEX IF EXISTS idx_users_subscription_id')

  await db.none(`
    ALTER TABLE users
      DROP COLUMN IF EXISTS subscription_id,
      DROP COLUMN IF EXISTS last_seen_at,
      DROP COLUMN IF EXISTS marketing_opt_in,
      DROP COLUMN IF EXISTS phone,
      DROP COLUMN IF EXISTS timezone,
      DROP COLUMN IF EXISTS locale,
      DROP COLUMN IF EXISTS display_name,
      DROP COLUMN IF EXISTS avatar_url
  `)
  console.log('[002_user_fields_subscription_attribution] rolled back — removed profile columns + subscription_id')
}
