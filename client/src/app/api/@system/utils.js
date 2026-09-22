// @system — shared API utilities (fetch wrapper, auth headers, error handling)
// Do not modify this file. Override or extend in @custom/

const IS_TUNNEL = !window.location.origin.includes('localhost')
const API_BASE = IS_TUNNEL ? `${window.location.origin}/api` : '/api'

function getAuthHeaders(){
  try {
    const raw = localStorage.getItem('auth')
    if (!raw) return {}
    const auth = JSON.parse(raw)
    const headers = {}
    if (auth.bearerToken) {
      headers['Authorization'] = `Bearer ${auth.bearerToken}`
    }
    if (auth.id) {
      headers['X-User-ID'] = String(auth.id)
    }
    return headers
  } catch {
    return {}
  }
}


async function request(
  path,
  options = {},
) {
  const isFormData = options.body instanceof FormData
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers) }
  if (!isFormData) {
    headers['Content-Type'] = 'application/json'
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      ...options,
      headers })
    const json = await res.json().catch(() => ({}))

    if (!res.ok) {
      return {
        status: res.status,
        message: json?.message ?? res.statusText }
    }
    return { status: res.status, data: json?.data ?? json, message: json?.message }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error'
    return { status: 0, message }
  }
}

export const apiRequest = {
  get: (path) => request(path),
  post: (path, body) =>
    request(path, { method: 'POST', body: JSON.stringify(body) }),
  postForm: (path, form) =>
    request(path, { method: 'POST', body: form }),
  patch: (path, body) =>
    request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: (path, body) =>
    request(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }) }
