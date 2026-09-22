// @system — Email verification page
// Opened when the user clicks the verification link from their email.
// URL format: /verify-email?token=<raw-token>
//
// On mount it immediately calls POST /api/users/email/verify with the token.
// Shows success or error state. If authenticated, updates user context.
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react'
import { api } from '../../../../lib/@system/api'
import { useAuthContext } from '../../../../store/@system/auth'
import { Button } from '../../../../components/@system/ui/button'
import { Card, CardContent } from '../../../../components/@system/Card'
import { info } from '@/config'

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const { refresh } = useAuthContext()

  const [status, setStatus] = useState(token ? 'loading' : 'missing_token')
  const [errorMessage, setErrorMessage] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendDone, setResendDone] = useState(false)

  // Use a ref to prevent double-invocation in React StrictMode
  const verified = useRef(false)

  useEffect(() => {
    if (!token || verified.current) return
    verified.current = true

    api
      .post('/users/email/verify', { token })
      .then(async () => {
        setStatus('success')
        // Refresh auth context so the banner disappears if user is logged in
        await refresh().catch(() => {})
      })
      .catch((err) => {
        setStatus('error')
        setErrorMessage(err.message)
      })
  }, [token, refresh])

  async function handleResend() {
    setResendLoading(true)
    try {
      await api.post('/users/email/verify/request', {})
      setResendDone(true)
    } catch {
      // Silently ignore — user may not be authenticated; they can log in first
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight text-brand-text">
            <img src={info.logo} alt="" className="h-8 w-8" />
            {info.name}
          </Link>
        </div>

        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            {/* Loading */}
            {status === 'loading' && (
              <>
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand-text-muted" />
                <h2 className="text-xl font-semibold">Verifying your email…</h2>
                <p className="text-sm text-brand-text-muted">Just a moment, please.</p>
              </>
            )}

            {/* Success */}
            {status === 'success' && (
              <>
                <CheckCircle className="mx-auto h-12 w-12 text-[var(--color-success)]" />
                <h2 className="text-xl font-semibold">Email verified!</h2>
                <p className="text-sm text-brand-text-muted">
                  Your email address has been confirmed. You're all set.
                </p>
                <Button asChild className="mt-2">
                  <Link to="/app">Go to dashboard</Link>
                </Button>
              </>
            )}

            {/* Invalid / expired token */}
            {status === 'error' && (
              <>
                <XCircle className="mx-auto h-12 w-12 text-[var(--color-error)]" />
                <h2 className="text-xl font-semibold">Verification failed</h2>
                <p className="text-sm text-brand-text-muted">
                  {errorMessage || 'This link is invalid or has expired.'}
                </p>
                {resendDone ? (
                  <p className="text-sm text-[var(--color-success)] font-medium">
                    A new verification email has been sent. Check your inbox.
                  </p>
                ) : (
                  <Button
                    variant="outline"
                    onClick={handleResend}
                    disabled={resendLoading}
                    className="mt-2"
                  >
                    {resendLoading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Resend verification email
                      </>
                    )}
                  </Button>
                )}
                <p className="text-xs text-brand-text-muted pt-2">
                  <Link to="/auth" className="underline hover:text-brand-text">
                    Back to sign in
                  </Link>
                </p>
              </>
            )}

            {/* No token in URL */}
            {status === 'missing_token' && (
              <>
                <Mail className="mx-auto h-12 w-12 text-brand-text-muted" />
                <h2 className="text-xl font-semibold">Check your inbox</h2>
                <p className="text-sm text-brand-text-muted">
                  We sent a verification link to your email address. Click it to confirm your account.
                </p>
                <p className="text-xs text-brand-text-muted">
                  <Link to="/auth" className="underline hover:text-brand-text">
                    Back to sign in
                  </Link>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
