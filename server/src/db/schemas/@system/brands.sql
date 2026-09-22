-- @system brands table (multi-brand SaaS support)
-- Each brand belongs to a subscription and a user.
-- Supports external integrations via external_id, tags, and metadata.
CREATE TABLE IF NOT EXISTS brands (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  description      TEXT,
  image_url        TEXT,
  logo_url         TEXT,
  website_url      TEXT,
  primary_color    TEXT,
  secondary_color  TEXT,
  external_id      TEXT,
  tags             TEXT[] DEFAULT '{}',
  metadata         JSONB DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'draft', 'archived', 'deleted', 'inactive')),
  settings         JSONB,
  subscription_id  INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
  user_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brands_slug ON brands(slug);
CREATE INDEX IF NOT EXISTS idx_brands_status ON brands(status);
CREATE INDEX IF NOT EXISTS idx_brands_user_id ON brands(user_id);
CREATE INDEX IF NOT EXISTS idx_brands_subscription_id ON brands(subscription_id);
CREATE INDEX IF NOT EXISTS idx_brands_external_id ON brands(external_id);
