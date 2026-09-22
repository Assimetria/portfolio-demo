-- @system metrics table
-- Entity-based metric snapshots for analytics tracking
CREATE TABLE IF NOT EXISTS metrics (
  id            SERIAL PRIMARY KEY,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  metric_type   TEXT NOT NULL,
  value         DOUBLE PRECISION NOT NULL DEFAULT 0,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metrics_entity ON metrics(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_metrics_type ON metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_metrics_snapshot_date ON metrics(snapshot_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_upsert ON metrics(entity_type, entity_id, metric_type, snapshot_date);
