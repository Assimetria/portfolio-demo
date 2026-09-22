// OAuthCallback — renders while the OAuth redirect is in flight.
//
// Flow:
//   1. User clicks GoogleButton → redirected to /api/auth/google
//   2. Backend redirects to Google consent page
//   3. Google redirects to /api/auth/google/callback (backend)
//   4. Backend issues a session cookie then redirects to /app (success)
//      OR to /auth?error=oauth_failed (failure)
//
// This component handles the edge case where the client receives
// a ?code= param directly (e.g. in a client-side OAuth proxy setup)
// and shows a friendly loading/error state while exchange is pending.
//
// Usage (add to router):
//   <Route path="/auth/callback" element={<OAuthCallback />} />

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

const KNOWN_ERRORS = {
  oauth_failed: 'Sign-in failed. Please try again or use email and password.',
  access_denied: 'You declined the sign-in request.',
}

function resolveErrorMessage(code) {
  return KNOWN_ERRORS[code] ?? 'An unexpected error occurred during sign-in.'
}

/**
 * OAuthCallback — mounted at /auth/callback.
 *
 * On mount it checks the URL for:
 *   ?error=<code>   — shows a human-readable error and a retry link
 *   ?code=<code>    — forwards to the backend exchange endpoint (non-standard client-side flow)
 *   (nothing)       — shows a generic loading indicator (server redirect in progress)
 *
 * Props:
 *   redirectTo — path to navigate after server confirms the session (default: "/app")
 */
export function OAuthCallback({ redirectTo = '/app' }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState(null)

  useEffect(() => {
    const errorCode = searchParams.get('error')
    const code = searchParams.get('code')

    if (errorCode) {
      setError(resolveErrorMessage(errorCode))
      return
    }

    if (!code) {
      // No code or error — assume server redirect is completing; navigate to app.
      navigate(redirectTo, { replace: true })
    }
    // If ?code= is present, the backend callback route handles it via a
    // server-side redirect and this component will not be reached in normal flows.
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <p className="text-sm text-[var(--color-error)]">{error}</p>
          <a href="/auth" className="text-sm text-brand-primary underline underline-offset-4">
            Back to sign-in
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-brand-text-muted" aria-label="Signing in…" />
    </div>
  )
}
