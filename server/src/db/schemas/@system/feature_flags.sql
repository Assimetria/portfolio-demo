-- Feature flags table for admin-managed toggles
CREATE TABLE IF NOT EXISTS feature_flags (
  id            SERIAL PRIMARY KEY,
  key           VARCHAR(100) NOT NULL UNIQUE,
  label         VARCHAR(255) NOT NULL,
  description   TEXT,
  enabled       BOOLEAN NOT NULL DEFAULT false,
  category      VARCHAR(50) NOT NULL DEFAULT 'general',
  updated_by    INTEGER REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_category ON feature_flags(category);
