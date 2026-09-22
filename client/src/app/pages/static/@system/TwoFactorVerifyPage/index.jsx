// @system — TOTP challenge page shown after password login when 2FA is required
// Receives { email, password } via router location state and re-submits with totpCode
import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/app/components/@system/ui/button'
import { FormField, Input } from '@/app/components/@system/Form'
import { api } from '@/app/lib/@system/api'
import { useAuthContext } from '@/app/store/@system/auth'


export function TwoFactorVerifyPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { refresh } = useAuthContext()
  const state = location.state ?? undefined

  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // If we end up here without credentials in state, redirect to auth
  if (!state?.email || !state?.password) {
    navigate('/auth', { replace: true })
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!code.trim()) {
      setError('Enter the 6-digit code from your authenticator app.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.post('/sessions', {
        email: state.email,
        password: state.password,
        totpCode: code.trim() })
      // Session cookie set — populate auth context then navigate
      await refresh()
      navigate('/app', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <ShieldCheck className="h-10 w-10 text-brand-text" />
          </div>
          <h1 className="text-2xl font-semibold text-brand-text">Two-Factor Authentication</h1>
          <p className="mt-1 text-sm text-brand-text-muted">
            Enter the code from your authenticator app to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <FormField label="Authenticator Code">
            <Input
              id="totp-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
          </FormField>

          {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Verifying…' : 'Verify'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-brand-text-muted">
          <Link to="/auth" className="font-medium text-brand-text underline underline-offset-4 hover:no-underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  )
}
