const db = require('../../../lib/@system/PostgreSQL')

const ApiKeyRepo = {
  async findAllByUser(userId) {
    return db.any(
      `SELECT id, user_id, name, key_prefix, scopes, request_count, rate_limit,
              last_used_at, expires_at, created_at
       FROM api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    )
  },

  async findByHash(keyHash) {
    return db.oneOrNone('SELECT * FROM api_keys WHERE key_hash = $1', [keyHash])
  },

  async create({ userId, name, keyHash, keyPrefix, expiresAt, scopes, rateLimit }) {
    return db.one(
      `INSERT INTO api_keys (user_id, name, key_hash, key_prefix, expires_at, scopes, rate_limit)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       RETURNING id, user_id, name, key_prefix, scopes, rate_limit, expires_at, created_at`,
      [userId, name, keyHash, keyPrefix, expiresAt ?? null, JSON.stringify(scopes ?? ['*']), rateLimit ?? null],
    )
  },

  async touchLastUsed(id) {
    return db.none(
      'UPDATE api_keys SET last_used_at = now(), request_count = request_count + 1 WHERE id = $1',
      [id],
    )
  },

  async deleteById(id, userId) {
    const result = await db.result(
      'DELETE FROM api_keys WHERE id = $1 AND user_id = $2',
      [id, userId],
    )
    return result.rowCount > 0
  },

  async logUsage({ apiKeyId, endpoint, method, status, ip }) {
    return db.none(
      `INSERT INTO api_key_usage (api_key_id, endpoint, method, status, ip)
       VALUES ($1, $2, $3, $4, $5)`,
      [apiKeyId, endpoint, method, status ?? null, ip ?? null],
    )
  },

  async getUsageStats(apiKeyId, { days = 30 } = {}) {
    return db.one(
      `SELECT
         COUNT(*)::int AS total_requests,
         COUNT(*) FILTER (WHERE status >= 200 AND status < 400)::int AS successful,
         COUNT(*) FILTER (WHERE status >= 400)::int AS errors,
         MIN(created_at) AS first_request,
         MAX(created_at) AS last_request
       FROM api_key_usage
       WHERE api_key_id = $1
         AND created_at > now() - ($2 || ' days')::interval`,
      [apiKeyId, days],
    )
  },

  async getUsageByEndpoint(apiKeyId, { days = 30, limit = 20 } = {}) {
    return db.any(
      `SELECT method, endpoint, COUNT(*)::int AS count
       FROM api_key_usage
       WHERE api_key_id = $1
         AND created_at > now() - ($2 || ' days')::interval
       GROUP BY method, endpoint
       ORDER BY count DESC
       LIMIT $3`,
      [apiKeyId, days, limit],
    )
  },

  async getRecentRequests(apiKeyId, { minutes = 1 } = {}) {
    const row = await db.one(
      `SELECT COUNT(*)::int AS count
       FROM api_key_usage
       WHERE api_key_id = $1
         AND created_at > now() - ($2 || ' minutes')::interval`,
      [apiKeyId, minutes],
    )
    return row.count
  },

  async updateScopes(id, userId, scopes) {
    const result = await db.result(
      `UPDATE api_keys SET scopes = $3::jsonb WHERE id = $1 AND user_id = $2`,
      [id, userId, JSON.stringify(scopes)],
    )
    return result.rowCount > 0
  },
}

module.exports = ApiKeyRepo
