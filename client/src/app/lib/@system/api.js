const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

/**
 * Error thrown by every non-2xx response. Carries the HTTP status and the
 * parsed JSON body so forms can branch on `status` (429, 503…) and surface
 * server-side field errors (`errors: [{ field, message }]`) without every
 * caller re-implementing fetch. Network failures are thrown as plain
 * `TypeError` by fetch itself (no `status`).
 */
export class ApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body ?? null
    this.errors = Array.isArray(body?.errors) ? body.errors : []
  }
}

// CSRF token cache — fetched once, reused for all mutations
let csrfToken = null

async function fetchCsrfToken() {
  try {
    const res = await fetch(`${BASE_URL}/csrf-token`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      csrfToken = data.token || data.csrfToken || null
    }
  } catch { /* silent — server may not require CSRF */ }
}

// Prevent concurrent refresh attempts
let refreshPromise = null

async function tryRefresh(){
  if (refreshPromise) return refreshPromise
  refreshPromise = fetch(`${BASE_URL}/sessions/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' } })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => { refreshPromise = null })
  return refreshPromise
}

async function request(path, options = {}, _retry = true){
  // Auto-fetch CSRF token before first mutation
  if (!csrfToken && options.method && options.method !== 'GET') {
    await fetchCsrfToken()
  }

  const headers = { 'Content-Type': 'application/json', ...options.headers }
  // Include CSRF token on all mutations
  if (csrfToken && options.method && options.method !== 'GET') {
    headers['X-CSRF-Token'] = csrfToken
  }

  // Spread options first, then override headers and credentials to ensure
  // cookies are always sent and merged headers (with CSRF) are always used.
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  // On CSRF error, refetch token and retry once
  if (res.status === 403 && _retry) {
    // Read body once — reuse for both CSRF detection and error throw
    const body = await res.json().catch(() => ({}))
    if (body.error === 'CSRF_VALIDATION_FAILED' || body.message?.includes('CSRF')) {
      csrfToken = null
      await fetchCsrfToken()
      return request(path, options, false)
    }
    // Non-CSRF 403 — throw with the already-parsed body (avoid double res.json())
    throw new ApiError(body.message ?? 'Forbidden', { status: 403, body })
  }

  // On 401, attempt a single token refresh then replay
  if (res.status === 401 && _retry && path !== '/sessions/refresh') {
    const refreshed = await tryRefresh()
    if (refreshed) {
      return request(path, options, false)
    }
    // Session is irrecoverably lost — redirect to auth page to prevent
    // blank-page crashes from components rendering without a user (#31871).
    // Only redirect if we're on a protected /app route to avoid disrupting
    // public pages or the auth page itself.
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/app')) {
      window.location.href = '/auth'
      // Return a never-resolving promise so callers don't continue executing
      // while the redirect is in progress.
      return new Promise(() => {})
    }
    const body = await res.json().catch(() => ({ message: 'Unauthorized' }))
    throw new ApiError(body.message ?? 'Unauthorized', { status: 401, body })
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }))
    throw new ApiError(body.message ?? 'API error', { status: res.status, body })
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  get: (path) => request(path),
  post: (path, body) =>
    request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) =>
    request(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path, body) =>
    request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),
}
