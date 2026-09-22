-- @system notifications table
-- In-app notifications for users (billing alerts, system messages, etc.)
CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Info',
  message     TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'info', -- 'info' | 'warning' | 'error' | 'success'
  seen_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_seen_at ON notifications(seen_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
