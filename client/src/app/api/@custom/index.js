// @custom API calls — product-specific API functions
// Add your custom API calls here.
// This file is NEVER overwritten during template sync.
//
// Example:
// import { api } from '../../lib/@system/api.js'
//
// export const getItems = () => api.get('/items')
// export const createItem = (data) => api.post('/items', data)
// export const updateItem = (id, data) => api.put(`/items/${id}`, data)
// export const deleteItem = (id) => api.delete(`/items/${id}`)

import { api } from '../../lib/@system/api'

export const getSearchTestConfig = () => api.get('/search-test')
export const runSearchTest = (params) => api.post('/search-test/run', params)
/**
 * Fetch the current push notification Lambda processor status.
 * @returns {Promise<{status: string, lastProcessedAt: string|null, totalProcessed: number, failedCount: number}>}
 */
export const getPushNotificationStatus = () => api.get('/push-notifications/status')

/**
 * Trigger a batch push notification processing via the Lambda processor.
 * @param {{ batchSize?: number, records?: Array, userId?: string, title?: string, body?: string }} params
 * @returns {Promise<{batchSize: number, processed: number, failed: number, startedAt: string, completedAt: string}>}
 */
export const triggerPushNotificationProcess = ({ batchSize = 100, records, userId, title, body } = {}) =>
  api.post('/push-notifications/process', { batchSize, records, userId, title, body })
