// LoginForm — reusable email+password login form
// Calls POST /api/auth/login and invokes onSuccess(user) on completion.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FormField, Input } from '@/app/components/@system/Form'
import { Button } from '@/app/components/@system/ui/button'
import { api } from '@/app/lib/@system/api'

function validate({ email, password }) {
  if (!email) return 'Email is required'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email'
  if (!password) return 'Password is required'
  if (password.length < 8) return 'Password must be at least 8 characters'
  return null
}

export function LoginForm({ onSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const validationError = validate({ email, password })
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      const result = await api.post('/auth/login', { email, password, rememberMe })
      if (result?.totp_required) {
        // 2FA required — caller must handle redirect
        onSuccess?.({ totp_required: true })
        return
      }
      onSuccess?.(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <FormField label="Email" required>
        <Input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          disabled={loading}
        />
      </FormField>

      <FormField label="Password" required>
        <Input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          disabled={loading}
        />
      </FormField>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-brand-text-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-[var(--brand-border-subtle)] accent-primary"
            disabled={loading}
          />
          Remember me
        </label>
        <Link
          to="/forgot-password"
          className="text-xs text-brand-text-muted underline underline-offset-4 hover:text-brand-text"
          tabIndex={-1}
        >
          Forgot password?
        </Link>
      </div>

      {error && (
        <p role="alert" className="text-sm text-[var(--color-error)]">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign In'}
      </Button>
    </form>
  )
}
