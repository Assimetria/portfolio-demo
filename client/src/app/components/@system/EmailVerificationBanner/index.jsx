// @system — Email verification banner
// Shown at the top of the app when the current user has not yet verified their email.
// Provides a "Resend" button that calls POST /api/users/email/verify/request.
//
// Usage: mount once inside an authenticated layout (e.g. <HomePage />, or the app shell).
// It hides itself automatically once email is verified (via auth context refresh).
import { useState } from 'react'
import { Mail, X, CheckCircle, Loader2 } from 'lucide-react'
import { api } from '../../../lib/@system/api'
import { useAuthContext } from '../../../store/@system/auth'

export function EmailVerificationBanner() {
  const { user } = useAuthContext()
  const [dismissed, setDismissed] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  // Don't render if verified, dismissed, or not logged in
  if (!user || user.emailVerified || dismissed) return null

  async function handleResend() {
    setSending(true)
    setError('')
    try {
      await api.post('/users/email/verify/request', {})
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send. Try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="w-full bg-[var(--color-warning-bg)] border-b border-[var(--color-warning)] text-[var(--color-warning)] px-4 py-2.5">
      <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <Mail className="h-4 w-4 shrink-0" />
          <span>
            <strong>Verify your email</strong> — we sent a link to{' '}
            <span className="font-medium">{user.email}</span>. Check your inbox to confirm your
            account.
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {sent ? (
            <span className="flex items-center gap-1 text-sm text-[var(--color-success)] font-medium">
              <CheckCircle className="h-4 w-4" />
              Email sent
            </span>
          ) : (
            <>
              {error && <span className="text-xs text-[var(--color-error)]">{error}</span>}
              <button
                onClick={handleResend}
                disabled={sending}
                className="text-sm font-medium underline underline-offset-2 hover:text-[var(--color-warning)] disabled:opacity-50 flex items-center gap-1"
              >
                {sending && <Loader2 className="h-3 w-3 animate-spin" />}
                Resend email
              </button>
            </>
          )}
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="ml-1 p-0.5 rounded hover:bg-[var(--color-warning-bg)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
