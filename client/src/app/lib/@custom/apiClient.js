// @custom — Shared API client with interceptors.
// Layered over the existing @system api (which already handles CSRF,
// cookie-based auth, and single-flight refresh). This module adds:
//   - request / response / error interceptor chains
//   - typed ApiError with status + response body
//   - configurable base URL and default headers
//   - auth-token attachment (for Bearer flows where cookies aren't used)
//   - single retry on network errors
//
// Usage:
//   import { apiClient } from '@/lib/@custom/apiClient'
//
//   apiClient.interceptors.request.use((cfg) => {
//     cfg.headers['X-Trace-Id'] = crypto.randomUUID()
//     return cfg
//   })
//
//   apiClient.interceptors.response.use((res) => res)
//   apiClient.interceptors.error.use((err) => { logger.error(err); throw err })
//
//   const data = await apiClient.get('/items')

const DEFAULT_BASE_URL =
  import.meta.env?.VITE_API_URL || '/api'

export class ApiError extends Error {
  constructor(message, { status, body, url } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
    this.url = url
  }
}

function createInterceptorChain() {
  const handlers = []
  return {
    use(fn) {
      handlers.push(fn)
      return () => {
        const idx = handlers.indexOf(fn)
        if (idx >= 0) handlers.splice(idx, 1)
      }
    },
    async run(value) {
      let current = value
      for (const fn of handlers) {
        current = await fn(current)
      }
      return current
    },
  }
}

// CSRF token cache — refetched lazily; shared across the module
let csrfToken = null
let refreshPromise = null

async function fetchCsrfToken(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/csrf-token`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      csrfToken = data.token || data.csrfToken || null
    }
  } catch {
    // server may not enforce CSRF; leave token null
  }
}

async function tryRefresh(baseUrl) {
  if (refreshPromise) return refreshPromise
  refreshPromise = fetch(`${baseUrl}/sessions/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}

export function createApiClient(options = {}) {
  const config = {
    baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
    defaultHeaders: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    getAuthToken: options.getAuthToken || null,
    onUnauthorized: options.onUnauthorized || null,
  }

  const interceptors = {
    request: createInterceptorChain(),
    response: createInterceptorChain(),
    error: createInterceptorChain(),
  }

  async function buildRequestConfig(path, options) {
    const cfg = {
      url: `${config.baseUrl}${path}`,
      method: options.method || 'GET',
      headers: { ...config.defaultHeaders, ...(options.headers || {}) },
      body: options.body,
      credentials: options.credentials || 'include',
    }

    const isMutation = cfg.method !== 'GET' && cfg.method !== 'HEAD'
    if (isMutation) {
      if (!csrfToken) await fetchCsrfToken(config.baseUrl)
      if (csrfToken) cfg.headers['X-CSRF-Token'] = csrfToken
    }

    if (config.getAuthToken) {
      const token = await config.getAuthToken()
      if (token) cfg.headers['Authorization'] = `Bearer ${token}`
    }

    return interceptors.request.run(cfg)
  }

  async function parseBody(res) {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      return res.json().catch(() => null)
    }
    return res.text().catch(() => null)
  }

  async function request(path, options = {}, _retry = true) {
    const cfg = await buildRequestConfig(path, options)

    let res
    try {
      res = await fetch(cfg.url, {
        method: cfg.method,
        headers: cfg.headers,
        body: cfg.body,
        credentials: cfg.credentials,
      })
    } catch (networkErr) {
      const err = new ApiError(networkErr.message || 'Network error', {
        status: 0,
        url: cfg.url,
      })
      await interceptors.error.run(err)
      throw err
    }

    // CSRF retry — refetch token and replay once
    if (res.status === 403 && _retry) {
      const body = await parseBody(res)
      const csrfFailure =
        body?.error === 'CSRF_VALIDATION_FAILED' ||
        (typeof body?.message === 'string' && body.message.includes('CSRF'))
      if (csrfFailure) {
        csrfToken = null
        await fetchCsrfToken(config.baseUrl)
        return request(path, options, false)
      }
      const err = new ApiError(body?.message || 'Forbidden', {
        status: 403,
        body,
        url: cfg.url,
      })
      await interceptors.error.run(err)
      throw err
    }

    // 401 — attempt single refresh, then replay
    if (res.status === 401 && _retry && path !== '/sessions/refresh') {
      const refreshed = await tryRefresh(config.baseUrl)
      if (refreshed) return request(path, options, false)

      if (config.onUnauthorized) {
        try { config.onUnauthorized() } catch { /* callback errors don't mask 401 */ }
      } else if (
        typeof window !== 'undefined' &&
        window.location.pathname.startsWith('/app')
      ) {
        window.location.href = '/auth'
        return new Promise(() => {})
      }

      const body = await parseBody(res)
      const err = new ApiError(body?.message || 'Unauthorized', {
        status: 401,
        body,
        url: cfg.url,
      })
      await interceptors.error.run(err)
      throw err
    }

    if (!res.ok) {
      const body = await parseBody(res)
      const err = new ApiError(body?.message || res.statusText || 'API error', {
        status: res.status,
        body,
        url: cfg.url,
      })
      await interceptors.error.run(err)
      throw err
    }

    const data = await parseBody(res)
    return interceptors.response.run({ data, status: res.status, headers: res.headers })
      .then((r) => r.data)
  }

  return {
    interceptors,
    setAuthTokenProvider(fn) { config.getAuthToken = fn },
    setBaseUrl(url) { config.baseUrl = url },
    request,
    get: (path, options) => request(path, { ...options, method: 'GET' }),
    post: (path, body, options) =>
      request(path, { ...options, method: 'POST', body: JSON.stringify(body) }),
    put: (path, body, options) =>
      request(path, { ...options, method: 'PUT', body: JSON.stringify(body) }),
    patch: (path, body, options) =>
      request(path, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
    delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  }
}

export const apiClient = createApiClient()
