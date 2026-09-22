'use strict'

/**
 * Migration 008 — Integration configuration overrides
 *
 * Stores per-deployment integration configuration metadata.
 * This table does NOT store secrets (those stay in environment variables).
 * It stores soft configuration: active provider selection, display labels,
 * enabled/disabled toggles, and last-test timestamps for the admin UI.
 */

exports.up = async (db) => {
  await db.none(`
    CREATE TABLE IF NOT EXISTS integration_configs (
      id            SERIAL PRIMARY KEY,
      category      VARCHAR(64)  NOT NULL,        -- e.g. 'email', 'storage', 'payment'
      provider      VARCHAR(64)  NOT NULL,        -- e.g. 'ses', 's3', 'stripe'
      enabled       BOOLEAN      NOT NULL DEFAULT true,
      display_name  VARCHAR(128),                 -- Optional human-readable override
      notes         TEXT,                         -- Admin notes
      last_tested_at TIMESTAMPTZ,                 -- When POST /integrations/:id/test was last run
      last_test_ok  BOOLEAN,                      -- Whether the last test passed
      metadata      JSONB        DEFAULT '{}',    -- Provider-specific config hints (non-secret)
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

      UNIQUE (category, provider)
    )
  `)

  await db.none(`
    CREATE INDEX IF NOT EXISTS idx_integration_configs_category
      ON integration_configs (category)
  `)

  // Seed default rows for known integration categories
  await db.none(`
    INSERT INTO integration_configs (category, provider, enabled, display_name) VALUES
      ('email',         'ses',     false, 'AWS SES'),
      ('email',         'smtp',    false, 'SMTP / Resend'),
      ('email',         'console', true,  'Console (dev)'),
      ('payment',       'stripe',  false, 'Stripe'),
      ('payment',       'polar',   false, 'Polar.sh'),
      ('storage',       's3',      false, 'AWS S3'),
      ('storage',       'r2',      false, 'Cloudflare R2'),
      ('storage',       'local',   true,  'Local Filesystem'),
      ('notifications', 'slack',   false, 'Slack'),
      ('notifications', 'discord', false, 'Discord'),
      ('notifications', 'console', true,  'Console (dev)'),
      ('sms',           'twilio',  false, 'Twilio'),
      ('sms',           'vonage',  false, 'Vonage'),
      ('sms',           'console', true,  'Console (dev)'),
      ('oauth',         'google',  false, 'Google'),
      ('oauth',         'github',  false, 'GitHub')
    ON CONFLICT (category, provider) DO NOTHING
  `)

  console.log('[008_integration_configs] applied')
}

exports.down = async (db) => {
  await db.none('DROP TABLE IF EXISTS integration_configs CASCADE')
  console.log('[008_integration_configs] rolled back')
}
