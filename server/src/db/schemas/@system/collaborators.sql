-- @system collaborators table
-- Multi-user collaboration on brands with role-based access
CREATE TABLE IF NOT EXISTS collaborators (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  brand_id     INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'editor',   -- 'owner' | 'admin' | 'editor' | 'viewer'
  status       TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'active' | 'inactive' | 'rejected'
  invited_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  invite_email TEXT NOT NULL,
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collaborators_user_id ON collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_brand_id ON collaborators(brand_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_invite_email ON collaborators(invite_email);
CREATE INDEX IF NOT EXISTS idx_collaborators_status ON collaborators(status);
