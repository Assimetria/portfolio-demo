// @custom — Caching strategies API client
import { api } from '../../lib/@system/api.js'

/**
 * Get all caching strategies with their ratings and metadata.
 * Requires authentication.
 * @returns {Promise<{ok: boolean, count: number, strategies: Array}>}
 */
export async function getCachingStrategies() {
  return api.get('/caching/strategies')
}

/**
 * Get a caching recommendation for a given environment.
 * Requires authentication.
 * @param {{ hasRedis?: boolean, isMultiProcess?: boolean }} [env]
 * @returns {Promise<{ok: boolean, env: object, recommendation: object}>}
 */
export async function getCachingRecommendation(env) {
  return api.post('/caching/recommend', env || {})
}