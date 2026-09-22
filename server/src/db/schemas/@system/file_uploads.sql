-- File uploads table for tracking direct-to-cloud uploads
-- Supports S3, R2, and local storage via presigned URLs

CREATE TABLE IF NOT EXISTS file_uploads (
  id            SERIAL PRIMARY KEY,
  
  -- Ownership
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  
  -- File details
  key           TEXT NOT NULL UNIQUE,           -- Storage key (e.g., 'avatars/abc123.jpg')
  filename      TEXT NOT NULL,                  -- Original filename
  content_type  TEXT,                           -- MIME type (e.g., 'image/jpeg')
  size_bytes    BIGINT,                         -- File size in bytes
  bucket        TEXT,                           -- Storage bucket name
  
  -- Upload state
  status        TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'uploaded' | 'failed'
  confirmed_at  TIMESTAMPTZ,                    -- When upload was confirmed
  
  -- Soft delete support
  deleted_at    TIMESTAMPTZ,                    -- Soft delete timestamp
  
  -- Context
  metadata      JSONB,                          -- Extra context (e.g., tags, folder)
  
  -- Timestamps
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_file_uploads_user_id ON file_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_key ON file_uploads(key);
CREATE INDEX IF NOT EXISTS idx_file_uploads_status ON file_uploads(status);
CREATE INDEX IF NOT EXISTS idx_file_uploads_deleted_at ON file_uploads(deleted_at);
CREATE INDEX IF NOT EXISTS idx_file_uploads_created_at ON file_uploads(created_at DESC);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_file_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_file_uploads_updated_at
  BEFORE UPDATE ON file_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_file_uploads_updated_at();
