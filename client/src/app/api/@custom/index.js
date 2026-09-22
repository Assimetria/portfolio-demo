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
import { api } from '../lib/@system/api.js'

export const getPortfolioProjects = (params) => api.get('/portfolio-projects', { query: params })
export const getPortfolioProject = (id) => api.get(`/portfolio-projects/${id}`)
export const createPortfolioProject = (data) => api.post('/portfolio-projects', data)
export const updatePortfolioProject = (id, data) => api.patch(`/portfolio-projects/${id}`, data)
export const deletePortfolioProject = (id) => api.delete(`/portfolio-projects/${id}`)
// export const deleteItem = (id) => api.delete(`/items/${id}`)

import { api } from '../../lib/@system/api'

export const getSearchTestConfig = () => api.get('/search-test')
export const getWebhookBenchmark = (params) => api.get('/webhook-benchmark', { params })
export const runSearchTest = (params) => api.post('/search-test/run', params)
