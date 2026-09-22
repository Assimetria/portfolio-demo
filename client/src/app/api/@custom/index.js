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

// ── API Gateway Guide ─────────────────────────────────────────────────────────
export const getApiGatewayGuide = () => fetch('/api/api-gateway-guide').then((r) => r.json())
export const markGuideStepComplete = (stepId) =>
  fetch('/api/api-gateway-guide/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stepId }),
  }).then((r) => r.json())
export const resetGuideProgress = () =>
  fetch('/api/api-gateway-guide/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }).then((r) => r.json())
