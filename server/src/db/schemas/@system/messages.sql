-- @system messages table
-- Chat messages within threads
CREATE TABLE IF NOT EXISTS messages (
  id         SERIAL PRIMARY KEY,
  thread_id  INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  sender     TEXT NOT NULL DEFAULT 'user',  -- 'user' | 'assistant' | 'system'
  content    TEXT NOT NULL,
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender);
