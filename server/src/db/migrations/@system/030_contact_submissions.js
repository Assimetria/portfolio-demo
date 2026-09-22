'use strict';

/**
 * Migration 030 — contact_submissions
 *
 * Stores messages sent through the public contact form of the informational
 * website template (POST /api/contact). Tenant-less: one product = one site.
 * Mirrors db/schemas/@system/contact_submissions.sql.
 */

exports.up = async (db) => {
  await db.none(`
    CREATE TABLE IF NOT EXISTS contact_submissions (
      id           SERIAL PRIMARY KEY,
      name         TEXT NOT NULL,
      email        TEXT NOT NULL,
      phone        TEXT,
      subject      TEXT,
      message      TEXT NOT NULL,
      source_path  TEXT,
      ip           TEXT,
      user_agent   TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      read_at      TIMESTAMPTZ
    )
  `);
  await db.none('CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON contact_submissions(created_at DESC)');
  await db.none('CREATE INDEX IF NOT EXISTS idx_contact_submissions_unread ON contact_submissions(read_at) WHERE read_at IS NULL');
  console.log('[030_contact_submissions] applied — contact_submissions table created');
};

exports.down = async (db) => {
  await db.none('DROP TABLE IF EXISTS contact_submissions');
  console.log('[030_contact_submissions] rolled back');
};
