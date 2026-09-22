// @system — Search API calls
// Wraps the SearchAdapter API endpoints exposed by the server.
// Do not modify this file. Add product-specific search calls in @custom/

import { apiRequest } from './utils'

// ─── Search ──────────────────────────────────────────────────────────────────

export const search = (params) => {
  const qs = new URLSearchParams()
  qs.set('index', params.index)
  qs.set('q', params.q)
  if (params.filters) qs.set('filters', params.filters)
  if (params.sort)    qs.set('sort', params.sort)
  if (params.limit !== undefined)  qs.set('limit', String(params.limit))
  if (params.offset !== undefined) qs.set('offset', String(params.offset))
  if (params.fields)  qs.set('fields', params.fields)

  return apiRequest.get(`/search?${qs.toString()}`)
}

// ─── Indexing (admin) ─────────────────────────────────────────────────────────

export const indexDocument = (data) =>
  apiRequest.post('/search/index', data)

export const indexDocuments = (data) =>
  apiRequest.post('/search/index/bulk', data)

export const createIndex = (data) =>
  apiRequest.post('/search/indexes', data)

// ─── Deletion (admin) ─────────────────────────────────────────────────────────

export const deleteDocument = (indexName, id) =>
  apiRequest.delete(`/search/index/${encodeURIComponent(indexName)}/${encodeURIComponent(String(id))}`)

export const deleteIndex = (indexName) =>
  apiRequest.delete(`/search/indexes/${encodeURIComponent(indexName)}`)

// ─── Health (admin) ───────────────────────────────────────────────────────────

export const getSearchHealth = () =>
  apiRequest.get('/search/health')

export const getSearchHealthAll = () =>
  apiRequest.get('/search/health/all')
