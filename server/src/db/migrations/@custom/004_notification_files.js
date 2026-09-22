'use strict'

/**
 * @custom — Migration: Notification files table
 *
 * Creates a notification_files table to track files uploaded and attached
 * to in-app notifications. Files are stored in S3 (via StorageAdapter) and
 * this table links them back to their notification.
 *
 * Idempotent: safe to re-run (IF NOT EXISTS).
 */
exports.up = async (db) => {
  await db.none(`
    CREATE TABLE IF NOT EXISTS notification_files (
      id              SERIAL PRIMARY KEY,
      notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
      user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

      -- Storage details
      key             TEXT NOT NULL,
      filename        TEXT NOT NULL,
      content_type    TEXT,
      size_bytes      BIGINT NOT NULL DEFAULT 0,

      -- Timestamps
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_notification_files_notification_id
      ON notification_files(notification_id);
    CREATE INDEX IF NOT EXISTS idx_notification_files_user_id
      ON notification_files(user_id);
  `)

  console.log('[004_notification_files] created: notification_files table')
}

exports.down = async (db) => {
  await db.none('DROP TABLE IF EXISTS notification_files CASCADE')
  console.log('[004_notification_files] dropped: notification_files table')
}