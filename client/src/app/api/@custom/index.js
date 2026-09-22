// @custom API calls — product-specific API functions
// Add your custom API calls here.
// This file is NEVER overwritten during template sync.

import { api } from '../../lib/@system/api'

export const getSearchTestConfig = () => api.get('/search-test')
export const runSearchTest = (params) => api.post('/search-test/run', params)
