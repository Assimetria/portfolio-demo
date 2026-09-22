// PasswordResetForm — two-step password reset flow.
// Step 1: Email input → POST /api/auth/forgot-password
// Step 2: New password + confirm → POST /api/auth/reset-password (uses ?token= from URL)
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle } from 'lucide-react'
import { FormField, Input } from '@/app/components/@system/Form'
import { Button } from '@/app/components/@system/ui/button'
import { api } from '@/app/lib/@system/api'

const requestSchema = z.object({
  email: z.string().email('Enter a valid email address'),
})

const resetSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

/**
 * PasswordResetForm — handles both the "request reset" and "set new password" steps.
 *
 * When a `token` query param is present the component renders the confirm-password
 * form (Step 2). Otherwise it renders the email-request form (Step 1).
 *
 * Props:
 *   onSuccess() — optional callback invoked after a successful reset (step 2).
 */
export function PasswordResetForm({ onSuccess }) {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  return token ? (
    <ConfirmResetForm token={token} onSuccess={onSuccess} />
  ) : (
    <RequestResetForm />
  )
}

// ── Step 1: request a reset link ────────────────────────────────────────────

function RequestResetForm() {
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: '' },
  })

  async function onSubmit({ email }) {
    setServerError(null)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <CheckCircle className="h-8 w-8 text-emerald-500" />
        <p className="text-sm text-brand-text-muted">
          If an account with that email exists, a password reset link has been sent. Check your inbox.
        </p>
        <Link to="/auth" className="text-sm underline underline-offset-4 hover:text-brand-text text-brand-text-muted">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormField label="Email" error={errors.email?.message} required>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          error={!!errors.email}
          {...register('email')}
        />
      </FormField>

      {serverError && (
        <p role="alert" className="text-sm text-[var(--color-error)]">
          {serverError}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isSubmitting ? 'Sending…' : 'Send Reset Link'}
      </Button>

      <div className="text-center">
        <Link to="/auth" className="text-xs text-brand-text-muted underline underline-offset-4 hover:text-brand-text">
          Back to sign in
        </Link>
      </div>
    </form>
  )
}

// ── Step 2: set new password with token ─────────────────────────────────────

function ConfirmResetForm({ token, onSuccess }) {
  const [done, setDone] = useState(false)
  const [serverError, setServerError] = useState(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  async function onSubmit({ password }) {
    setServerError(null)
    try {
      await api.post('/auth/reset-password', { token, password })
      setDone(true)
      onSuccess?.()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Reset failed. The link may have expired.')
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <CheckCircle className="h-8 w-8 text-emerald-500" />
        <p className="text-sm text-brand-text-muted">Password updated successfully.</p>
        <Link to="/auth" className="text-sm underline underline-offset-4 hover:text-brand-text text-brand-text-muted">
          Sign in with your new password
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormField label="New password" error={errors.password?.message} required>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          error={!!errors.password}
          {...register('password')}
        />
      </FormField>

      <FormField label="Confirm new password" error={errors.confirmPassword?.message} required>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          error={!!errors.confirmPassword}
          {...register('confirmPassword')}
        />
      </FormField>

      {serverError && (
        <p role="alert" className="text-sm text-[var(--color-error)]">
          {serverError}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isSubmitting ? 'Updating…' : 'Set New Password'}
      </Button>
    </form>
  )
}
