-- Audit logs table for compliance and security tracking
-- Records all data changes with before/after snapshots

CREATE TABLE IF NOT EXISTS audit_logs (
  id            SERIAL PRIMARY KEY,
  
  -- Actor information
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_email   TEXT,                           -- Snapshot of email at time of action
  
  -- Action details
  action        TEXT NOT NULL,                   -- 'create' | 'update' | 'delete' | 'login' | custom
  resource_type TEXT NOT NULL,                   -- 'user' | 'post' | 'payment' | custom
  resource_id   TEXT,                            -- Resource primary key (as string)
  
  -- Data snapshots
  old_data      JSONB,                           -- Before state (NULL for creates)
  new_data      JSONB,                           -- After state (NULL for deletes)
  
  -- Context
  ip_address    TEXT,                            -- Request IP address
  user_agent    TEXT,                            -- Request user agent
  metadata      JSONB,                           -- Extra context (e.g., route, reason)
  
  -- Timestamp
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Composite index for resource history queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id, created_at DESC);

-- Full-text search on actor email
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_email ON audit_logs(actor_email);
