// @system — Reset password page
// Reads ?token= from the URL and submits to POST /api/users/password/reset
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '../../../../components/@system/ui/button'
import { FormField, Input } from '../../../../components/@system/Form'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/@system/Card'
import { api } from '../../../../lib/@system/api'
import { info } from '@/config'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!token) {
      setError('Reset token is missing. Please use the link from your email.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await api.post('/users/password/reset', { token, password })
      setSuccess(true)
      setTimeout(() => navigate('/auth'), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg px-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <Link to="/" className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight text-brand-text">
              <img src={info.logo} alt="" className="h-8 w-8" />
              {info.name}
            </Link>
          </div>
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <p className="text-sm text-[var(--color-error)]">
                Invalid reset link. Please request a new one.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/forgot-password">Request new link</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="text-center">
          <Link to="/" className="text-2xl font-bold tracking-tight text-brand-text">
            {info.name}
          </Link>
          <p className="mt-1 text-sm text-brand-text-muted">Set a new password</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Reset your password</CardTitle>
            <CardDescription>
              Choose a strong password with at least 8 characters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center space-y-2">
                <div className="rounded-full bg-brand-surface p-3">
                  <CheckCircle2 className="h-6 w-6 text-[var(--color-success)]" />
                </div>
                <p className="text-sm font-medium text-brand-text">Password reset successfully!</p>
                <p className="text-sm text-brand-text-muted">
                  Redirecting you to sign in…
                </p>
                <Button asChild variant="outline" className="w-full mt-2">
                  <Link to="/auth">Sign in now</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <FormField label="New password" required>
                  <Input
                    type="password"
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </FormField>
                <FormField label="Confirm password" required>
                  <Input
                    type="password"
                    placeholder="Re-enter your password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </FormField>
                {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? 'Resetting…' : 'Reset password'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
