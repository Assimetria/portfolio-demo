// RegisterForm — reusable email+password registration form component
// Calls POST /api/auth/register and invokes onSuccess(result) on completion.
// Auth form: Email + Password ONLY (no name fields — display name derived from email)
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { FormField, Input } from '@/app/components/@system/Form'
import { Button } from '@/app/components/@system/ui/button'
import { api } from '@/app/lib/@system/api'

const registerSchema = z
  .object({
    email: z.string().email('Enter a valid email address'),
    password: z
      .string()
      .min(12, 'Password must be at least 12 characters')
      .refine((p) => /[A-Z]/.test(p), 'Password must contain at least one uppercase letter')
      .refine((p) => /[0-9]/.test(p), 'Password must contain at least one number')
      .refine((p) => /[^A-Za-z0-9]/.test(p), 'Password must contain at least one special character'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

/**
 * Standalone registration form. Calls POST /api/auth/register.
 *
 * Props:
 *   onSuccess(result) — called with the API response on successful registration.
 */
export function RegisterForm({ onSuccess }) {
  const [serverError, setServerError] = useState(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  })

  async function onSubmit(values) {
    setServerError(null)
    try {
      const { confirmPassword: _, ...rest } = values
      const displayName = rest.email.split('@')[0] || ''
      const result = await api.post('/auth/register', { name: displayName, ...rest })
      onSuccess?.(result)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Registration failed. Please try again.')
    }
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

      <FormField label="Password" error={errors.password?.message} required>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          error={!!errors.password}
          {...register('password')}
        />
      </FormField>

      <FormField label="Confirm Password" error={errors.confirmPassword?.message} required>
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
        {isSubmitting ? 'Creating account…' : 'Create Account'}
      </Button>
    </form>
  )
}
