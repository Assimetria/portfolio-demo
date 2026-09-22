'use strict';

/**
 * Migration 031 — contact_submissions retention
 *
 * Adds `retention_expires_at` so the daily ContactRetentionPurgeTask can
 * delete personal data once the configured window elapses (GDPR storage
 * limitation, Art. 5(1)(e)).
 *
 * The window comes from api/@system/contact/config.js
 * (brand.json site.contact.retentionDays → CONTACT_RETENTION_DAYS → 180) so
 * the backfill, the repo insert and the purge task all use one number.
 * The column default is a safety net for rows inserted outside ContactRepo;
 * the repo always sets the value explicitly.
 *
 * Idempotent: safe to re-run (IF NOT EXISTS / backfill only NULLs).
 */

const { retentionDays } = require('../../../api/@system/contact/config');
const { toIntervalLiteral } = require('../../../lib/@system/Helpers/date');

exports.up = async (db) => {
  const interval = toIntervalLiteral(retentionDays());

  await db.none(`
    ALTER TABLE contact_submissions
      ADD COLUMN IF NOT EXISTS retention_expires_at TIMESTAMPTZ
  `);

  // Backfill: measure existing rows from their created_at.
  await db.none(
    `UPDATE contact_submissions
        SET retention_expires_at = created_at + $1::interval
      WHERE retention_expires_at IS NULL`,
    [interval],
  );

  // Default for raw inserts + NOT NULL now that every row has a value.
  await db.none(`
    ALTER TABLE contact_submissions
      ALTER COLUMN retention_expires_at SET DEFAULT (now() + interval '${interval}'),
      ALTER COLUMN retention_expires_at SET NOT NULL
  `);

  await db.none(
    'CREATE INDEX IF NOT EXISTS idx_contact_submissions_retention ON contact_submissions(retention_expires_at)',
  );

  console.log(`[031_contact_submissions_retention] applied — retention_expires_at added (window: ${interval})`);
};

exports.down = async (db) => {
  await db.none('DROP INDEX IF EXISTS idx_contact_submissions_retention');
  await db.none('ALTER TABLE contact_submissions DROP COLUMN IF EXISTS retention_expires_at');
  console.log('[031_contact_submissions_retention] rolled back');
};
