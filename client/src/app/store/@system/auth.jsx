// @system — Consolidated auth provider (cookie sessions).
//
// Single source of truth for authentication. The server issues an httpOnly
// access_token + refresh_token cookie pair from POST /api/sessions; the browser
// never sees a bearer token. Every call goes through lib/@system/api.js, which
// sends `credentials: 'include'`, attaches the CSRF token to mutations and
// transparently replays a request once after POST /api/sessions/refresh.
//
//   mount     → GET    /api/sessions/me        → { user | null }
//   login     → POST   /api/sessions           → { user }   (sets cookies)
//   register  → POST   /api/sessions/register  → { user }   (sets cookies)
//   logout    → DELETE /api/sessions           (blacklists + revokes cookies)
//
// The previous implementation kept a bearer token in localStorage and skipped
// the session check when none was stored, so cookie-authenticated users always
// appeared logged out. Do not reintroduce localStorage tokens here.
//
// To extend: import { AuthContext, useAuthContext } and build @custom hooks on top.
import { createContext, useState, useEffect, useCallback, useContext, useMemo } from 'react'
import { api } from '@/app/lib/@system/api'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Re-read the current session (e.g. after profile edits or email verification).
  const refresh = useCallback(async () => {
    try {
      const data = await api.get('/sessions/me')
      const next = data?.user ?? null
      setUser(next)
      return next
    } catch {
      setUser(null)
      return null
    }
  }, [])

  // Session check on mount — cookies are sent automatically.
  useEffect(() => {
    let cancelled = false
    api
      .get('/sessions/me')
      .then((data) => { if (!cancelled) setUser(data?.user ?? null) })
      .catch(() => { if (!cancelled) setUser(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (email, password, opts = {}) => {
    const data = await api.post('/sessions', { email, password, ...opts })
    if (data?.user) setUser(data.user)
    return data
  }, [])

  const register = useCallback(async (email, password, name, opts = {}) => {
    const data = await api.post('/sessions/register', { email, password, name, ...opts })
    if (data?.user) setUser(data.user)
    return data
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.delete('/sessions')
    } catch {
      // Cookies may already be gone — clearing local state is what matters.
    }
    setUser(null)
  }, [])

  // Legacy helper for callers that still fetch raw URLs: same-origin request
  // with cookies. Prefer `api` from lib/@system/api for new code.
  const authFetch = useCallback(
    (url, options = {}) =>
      fetch(url, {
        credentials: 'include',
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers },
      }),
    [],
  )

  const value = useMemo(
    () => ({
      user,
      setUser,
      loading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      refresh,
      authFetch,
      // Kept for API compatibility with older @custom code; cookie auth has no
      // client-readable token.
      token: null,
    }),
    [user, loading, login, register, logout, refresh, authFetch],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// useAuthContext — the main hook for all components
export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used inside <AuthProvider>')
  return ctx
}

// Alias for convenience
export const useAuth = useAuthContext
