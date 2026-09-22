// @system — admin API calls (owner-only)
// Do not modify this file. Add product-specific admin calls in @custom/

import { apiRequest } from './utils.js'

export const getAdminUsersStats = (params) => {
  const qs = new URLSearchParams()
  if (params?.startDate && params?.endDate) {
    qs.set('dateWindow', 'custom')
    qs.set('startDate', params.startDate)
    qs.set('endDate', params.endDate)
  } else {
    qs.set('dateWindow', 'today')
  }
  return apiRequest.get(`/admin/users/stats?${qs}`)
}

export const getAdminUsers = (params) => {
  const qs = new URLSearchParams()
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.search) qs.set('search', params.search)
  if (params?.sortBy) qs.set('sortBy', params.sortBy)
  if (params?.sortOrder) qs.set('sortOrder', params.sortOrder)
  if (params?.country) qs.set('country', params.country)
  if (params?.status) qs.set('status', params.status)
  if (params?.startDate) qs.set('startDate', params.startDate)
  if (params?.endDate) qs.set('endDate', params.endDate)
  return apiRequest.get(`/admin/users?${qs}`)
}

export const getAdminUserDetails = (userId) =>
  apiRequest.get(`/admin/users/${userId}`)

export const getAdminSubscriptions = (params) => {
  const qs = new URLSearchParams()
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.startDate) qs.set('startDate', params.startDate)
  if (params?.endDate) qs.set('endDate', params.endDate)
  return apiRequest.get(`/admin/subscriptions?${qs}`)
}

export const getAdminCancellations = (params) => {
  const qs = new URLSearchParams()
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.startDate) qs.set('startDate', params.startDate)
  if (params?.endDate) qs.set('endDate', params.endDate)
  return apiRequest.get(`/admin/cancellations?${qs}`)
}

export const getAdminFinancials = (params) => {
  const qs = new URLSearchParams()
  if (params?.startDate) qs.set('startDate', params.startDate)
  if (params?.endDate) qs.set('endDate', params.endDate)
  return apiRequest.get(`/admin/financials?${qs}`)
}

export const getAdminPerformance = (params) => {
  const qs = params?.window ? `?window=${params.window}` : ''
  return apiRequest.get(`/admin/performance${qs}`)
}

// ── Feature Flags ────────────────────────────────────────────────────────────

export const getFeatureFlags = (params) => {
  const qs = params?.category ? `?category=${params.category}` : ''
  return apiRequest.get(`/admin/feature-flags${qs}`)
}

export const getFeatureFlag = (key) =>
  apiRequest.get(`/admin/feature-flags/${key}`)

export const toggleFeatureFlag = (key, enabled) =>
  apiRequest.patch(`/admin/feature-flags/${key}`, { enabled })

export const createFeatureFlag = (data) =>
  apiRequest.post('/admin/feature-flags', data)

export const deleteFeatureFlag = (key) =>
  apiRequest.delete(`/admin/feature-flags/${key}`)

// ── Email Logs ───────────────────────────────────────────────────────────────

export const getEmailLogs = (params) => {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.template) qs.set('template', params.template)
  if (params?.search) qs.set('search', params.search)
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.offset) qs.set('offset', String(params.offset))
  return apiRequest.get(`/email-logs?${qs}`)
}

export const getEmailLogStats = () =>
  apiRequest.get('/email-logs/stats')

// ── Cancellations report (global date range) ─────────────────────────────────
// Backed by the financials report endpoint which filters cancellation activity
// to the supplied window. `startDate`/`endDate` take precedence over `period`;
// when omitted the server falls back to the named period.
export const listCancellations = (params) => {
  const qs = new URLSearchParams()
  if (params?.period) qs.set('period', params.period)
  if (isISOAnchor(params?.startDate)) qs.set('startDate', params.startDate)
  if (isISOAnchor(params?.endDate)) qs.set('endDate', params.endDate)
  return apiRequest.get(`/admin/financials/cancellations?${qs}`)
}

function isISOAnchor(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}
