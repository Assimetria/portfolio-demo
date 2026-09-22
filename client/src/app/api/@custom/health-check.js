// @custom — Health check dependencies API client
import { api } from '../../lib/@system/api.js'

/**
 * Get aggregated health check for all downstream service dependencies.
 * Requires authentication.
 * @returns {Promise<{status: string, timestamp: string, uptime: number, dependencies: Array, summary: object}>}
 */
export async function getHealthCheckDependencies() {
  return api.get('/health-check/dependencies')
}
