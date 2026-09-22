-- @system refresh_tokens table
-- Stores opaque refresh tokens for JWT rotation.
-- Each token is stored as a SHA-256 hash; raw tokens are never persisted.
-- family_id groups tokens issued in the same login session for reuse-attack detection:
-- if a revoked token is presented, all tokens in that family are revoked immediately.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  family_id   UUID NOT NULL DEFAULT gen_random_uuid(),
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  replaced_by BIGINT REFERENCES refresh_tokens(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rt_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_rt_user_id    ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_rt_family_id  ON refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_rt_expires_at ON refresh_tokens(expires_at);
