-- @system subscriptions table
-- Full billing model: supports Stripe subscriptions, one-time purchases, trials,
-- cancellation tracking, UTM attribution, and metadata for webhook state.
--
-- NOTE: brand_id column is added by migration 011 (brands_system_subscription_upgrade)
-- to avoid circular FK dependency (brands references subscriptions, subscriptions references brands).
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      SERIAL PRIMARY KEY,
  user_id                 INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id  TEXT UNIQUE,       -- Stripe subscription ID (external_id)
  stripe_customer_id      TEXT,
  stripe_price_id         TEXT,
  plan                    TEXT DEFAULT 'free',
  status                  TEXT NOT NULL DEFAULT 'inactive',
    -- 'active' | 'inactive' | 'canceled' | 'expired' | 'trialing' | 'past_due'
  price                   INTEGER DEFAULT 0, -- in cents
  periodicity             TEXT,              -- 'month' | 'year' | 'one-time'
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN NOT NULL DEFAULT false,
  last_renew              TIMESTAMPTZ,
  utm_source              TEXT,
  referrer                TEXT,
  payment_provider        TEXT DEFAULT 'stripe',
  metadata                JSONB DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at ON subscriptions(created_at);
