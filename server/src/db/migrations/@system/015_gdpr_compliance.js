'use strict'

/**
 * Migration 015 – GDPR Compliance
 * Task #27886
 *
 * Creates:
 *   gdpr_consent_log — records cookie/privacy consent events per session (GDPR Art. 7)
 */

exports.up = async (db) => {
  await db.none(`
    CREATE TABLE IF NOT EXISTS gdpr_consent_log (
      id                  SERIAL PRIMARY KEY,
      session_id          TEXT,
      user_id             INTEGER     REFERENCES users(id) ON DELETE SET NULL,
      analytics_consent   BOOLEAN     NOT NULL DEFAULT false,
      marketing_consent   BOOLEAN     NOT NULL DEFAULT false,
      functional_consent  BOOLEAN     NOT NULL DEFAULT true,
      consent_value       TEXT        NOT NULL DEFAULT 'essential'
                          CHECK (consent_value IN ('essential', 'all')),
      consent_version     TEXT        NOT NULL DEFAULT '1.0',
      ip_address          TEXT,
      user_agent          TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  await db.none(`
    CREATE INDEX IF NOT EXISTS idx_gdpr_consent_log_user_id
      ON gdpr_consent_log (user_id)
  `)

  await db.none(`
    CREATE INDEX IF NOT EXISTS idx_gdpr_consent_log_created_at
      ON gdpr_consent_log (created_at)
  `)

  console.log('[015_gdpr_compliance] ✓ gdpr_consent_log table created')
}

exports.down = async (db) => {
  await db.none('DROP TABLE IF EXISTS gdpr_consent_log CASCADE')
  console.log('[015_gdpr_compliance] ✗ gdpr_consent_log table dropped')
}
