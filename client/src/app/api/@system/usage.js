// @system — Usage and cost tracking API client

import { apiRequest as api } from './utils.js'

/**
 * Get dashboard cost summary
 * @returns {Promise<{today, thisMonth, trends, topServices, limits}>}
 */
export async function getUsageDashboard() {
  const response = await api.get('/usage/dashboard')
  return response
}

/**
 * Get usage history with filters
 * @param {object} params - { days?, service?, limit?, page? }
 * @returns {Promise<{events, pagination}>}
 */
export async function getUsageHistory(params = {}) {
  const query = new URLSearchParams(params).toString()
  const response = await api.get(`/usage/history?${query}`)
  return response
}

/**
 * Get cost breakdown by service and model
 * @param {string} period - 'day' | 'week' | 'month'
 * @returns {Promise<{byService, byModel, total}>}
 */
export async function getCostBreakdown(period = 'month') {
  const response = await api.get(`/usage/breakdown?period=${period}`)
  return response
}

/**
 * Track usage event (for internal use)
 * @param {object} event - { service, operation, model?, cost, tokens?, bytes?, metadata? }
 * @returns {Promise<{ok: boolean}>}
 */
export async function trackUsage(event) {
  const response = await api.post('/usage/track', event)
  return response
}
