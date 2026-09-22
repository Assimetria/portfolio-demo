-- @system users table
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user',
  stripe_customer_id TEXT,
  email_verified_at TIMESTAMPTZ,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  onboarding_completed_at TIMESTAMPTZ,
  avatar_url    TEXT,
  display_name  TEXT,
  locale        TEXT NOT NULL DEFAULT 'en',
  timezone      TEXT,
  phone         TEXT,
  marketing_opt_in BOOLEAN NOT NULL DEFAULT false,
  last_seen_at  TIMESTAMPTZ,
  -- owning-subscription pointer (subscription_id) is added by @custom migration
  -- 002_user_fields_subscription_attribution to avoid a circular FK at init time:
  -- this table is created before subscriptions in migration 001_init.
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
