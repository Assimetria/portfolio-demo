'use strict';

/**
 * Migration 029 — Add family_created_at to sessions table
 *
 * The auth middleware enforces a hard 30-day cap on opaque session family
 * lifetime using sessions.family_created_at. Without this column every
 * session auth attempt using a 96-hex opaque token is rejected because
 * the code treats a missing family_created_at as an expired family.
 *
 * Existing rows default to their created_at so their family age is
 * measured from when the session was originally created.
 */

exports.up = async (db) => {
  try {
    await db.none(`
      ALTER TABLE sessions
        ADD COLUMN family_created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    `);
  } catch (err) {
    if (err.message && err.message.includes('already exists')) {
      console.log('[029_sessions_family_created_at] column already exists — skipping');
      return;
    }
    throw err;
  }

  // Back-fill existing sessions: use their created_at as the family origin
  await db.none(`
    UPDATE sessions
       SET family_created_at = created_at
     WHERE family_created_at IS DISTINCT FROM created_at
  `);

  console.log('[029_sessions_family_created_at] applied — family_created_at column added to sessions');
};

exports.down = async (db) => {
  await db.none('ALTER TABLE sessions DROP COLUMN IF EXISTS family_created_at');
  console.log('[029_sessions_family_created_at] rolled back');
};
