-- Email logs table for tracking all sent emails
-- Supports analytics, debugging, and compliance

CREATE TABLE IF NOT EXISTS email_logs (
  id            SERIAL PRIMARY KEY,
  
  -- Email details
  to_address    TEXT NOT NULL,
  subject       TEXT NOT NULL,
  template      TEXT,                           -- 'verification' | 'password_reset' | 'welcome' | etc.
  
  -- Delivery tracking
  status        TEXT NOT NULL DEFAULT 'sent',   -- 'sent' | 'delivered' | 'bounced' | 'failed'
  message_id    TEXT,                           -- Provider message ID for tracking
  provider      TEXT,                           -- 'resend' | 'smtp' | 'ses' | 'console'
  error         TEXT,                           -- Error message if status = 'failed'
  
  -- Context
  metadata      JSONB,                          -- Extra context (e.g., campaign, trigger)
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  
  -- Timestamps
  sent_at       TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_template ON email_logs(template);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_to_address ON email_logs(to_address);

-- Search index for to_address and subject
CREATE INDEX IF NOT EXISTS idx_email_logs_search ON email_logs USING gin(to_tsvector('english', to_address || ' ' || subject));

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_email_logs_updated_at
  BEFORE UPDATE ON email_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_email_logs_updated_at();
