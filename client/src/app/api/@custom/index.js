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

export const getAlertingConfig = () => api.get('/comments-alerting/config')
export const updateAlertingConfig = (data) => api.put('/comments-alerting/config', data)
export const sendTestAlert = () => api.post('/comments-alerting/test')
