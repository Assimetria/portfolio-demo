-- @system contact_submissions table
-- Messages sent through the public contact form (POST /api/contact).
-- Tenant-less: one deployed product = one website.
-- retention_expires_at: purged daily by ContactRetentionPurgeTask once elapsed
-- (window from brand.json site.contact.retentionDays / CONTACT_RETENTION_DAYS, default 180).
CREATE TABLE IF NOT EXISTS contact_submissions (
  id                    SERIAL PRIMARY KEY,
  name                  TEXT NOT NULL,
  email                 TEXT NOT NULL,
  phone                 TEXT,
  subject               TEXT,
  message               TEXT NOT NULL,
  source_path           TEXT,
  ip                    TEXT,
  user_agent            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at               TIMESTAMPTZ,
  retention_expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '180 days')
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON contact_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_unread ON contact_submissions(read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contact_submissions_retention ON contact_submissions(retention_expires_at);
