// @custom API calls — product-specific API functions
// Add your custom API calls here.
// This file is NEVER overwritten during template sync.
//
// Example:
import { api } from '../../lib/@system/api.js'

// ── Billing Editor API ─────────────────────────────────────────────────────

export const getBillingItems = () => api.get('/billing/items')

export const createBillingItem = (data) => api.post('/billing/items', data)

export const updateBillingItem = (id, data) => api.put(`/billing/items/${id}`, data)

export const deleteBillingItem = (id) => api.delete(`/billing/items/${id}`)

export const undoBillingAction = () => api.post('/billing/items/undo', {})

export const redoBillingAction = () => api.post('/billing/items/redo', {})
