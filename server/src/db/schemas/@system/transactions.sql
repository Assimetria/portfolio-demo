-- @system transactions table
-- Records all financial transactions: subscription payments, one-time purchases, credits, refunds
CREATE TABLE IF NOT EXISTS transactions (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount        INTEGER NOT NULL DEFAULT 1,
  type          TEXT NOT NULL,             -- 'subscription' | 'one-time' | 'credits' | 'refund'
  credits       INTEGER NOT NULL DEFAULT 0,
  price         INTEGER NOT NULL DEFAULT 0, -- in cents
  status        TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'completed' | 'paid' | 'failed' | 'refunded'
  description   TEXT NOT NULL,
  external_id   TEXT,                      -- Stripe charge/payment/invoice ID
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_external_id ON transactions(external_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
