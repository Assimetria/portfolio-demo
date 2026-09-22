// @system — Metric repository (raw SQL / pg-promise)
const db = require('../../../lib/@system/PostgreSQL')

const MetricRepo = {
  async createSnapshot({ entity_type, entity_id, metric_type, value, snapshot_date, metadata = {} }) {
    return db.one(
      `INSERT INTO metrics (entity_type, entity_id, metric_type, value, snapshot_date, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (entity_type, entity_id, metric_type, snapshot_date)
       DO UPDATE SET value = $4, metadata = $6
       RETURNING *`,
      [entity_type, String(entity_id), metric_type, value, snapshot_date || new Date().toISOString().split('T')[0], JSON.stringify(metadata)],
    )
  },

  async getLatest(entityType, entityId, metricType) {
    return db.oneOrNone(
      `SELECT * FROM metrics
       WHERE entity_type = $1 AND entity_id = $2 AND metric_type = $3
       ORDER BY snapshot_date DESC LIMIT 1`,
      [entityType, String(entityId), metricType],
    )
  },

  async getHistory(entityType, entityId, metricType, startDate, endDate) {
    return db.any(
      `SELECT * FROM metrics
       WHERE entity_type = $1 AND entity_id = $2 AND metric_type = $3
         AND snapshot_date BETWEEN $4 AND $5
       ORDER BY snapshot_date ASC`,
      [entityType, String(entityId), metricType, startDate, endDate],
    )
  },

  async getSnapshots({ entity_type, entity_id, metric_type, start_date, end_date }) {
    return db.any(
      `SELECT * FROM metrics
       WHERE entity_type = $1 AND entity_id = $2 AND metric_type = $3
         AND snapshot_date BETWEEN $4 AND $5
       ORDER BY snapshot_date ASC`,
      [entity_type, String(entity_id), metric_type, start_date, end_date],
    )
  },

  async logDaily(entityType, entityId, metricType, value, metadata = {}) {
    const today = new Date().toISOString().split('T')[0]
    return this.createSnapshot({
      entity_type: entityType,
      entity_id: entityId,
      metric_type: metricType,
      value,
      snapshot_date: today,
      metadata,
    })
  },

  async getDateRange(entityType, entityId, metricType) {
    return db.oneOrNone(
      `SELECT MIN(snapshot_date) AS earliest, MAX(snapshot_date) AS latest
       FROM metrics
       WHERE entity_type = $1 AND entity_id = $2 AND metric_type = $3`,
      [entityType, String(entityId), metricType],
    )
  },
}

module.exports = MetricRepo
