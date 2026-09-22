// @system — Forgot password page (split layout matching AuthPage)
// Desktop: left panel = brand, right panel = form. Mobile: centered form.
// Sends a reset link to the user's email via POST /api/users/password/request
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, ArrowLeft, Mail, Shield, Zap, Globe } from 'lucide-react'
import { Button } from '../../../../components/@system/ui/button'
import { FormField, Input } from '../../../../components/@system/Form'
import { api } from '../../../../lib/@system/api'
import { info } from '@/config'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email) {
      setError('Please enter your email address')
      return
    }
    setError('')
    setLoading(true)
    try {
      await api.post('/users/password/request', { email })
      setSubmitted(true)
    } catch {
      // Still show success to avoid user enumeration
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-brand-bg">
      {/* -- Left Panel — clean brand panel, NO colored background ------------ */}
      <div className="hidden lg:flex w-[45%] flex-shrink-0 relative overflow-hidden flex-col p-12 bg-brand-surface border-r border-brand-border">
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(color-mix(in srgb, var(--brand-border) 50%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--brand-border) 50%, transparent) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}
        />

        <div className="relative z-10 flex flex-col h-full">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-brand-text">
            <img src={info.logo} alt="" className="h-8 w-8" />
            {info.name}
          </Link>

          {/* Hero content */}
          <div className="flex-1 flex flex-col justify-center">
            <h1 className="text-3xl xl:text-4xl font-bold leading-tight text-brand-text">
              {info.tagline}
            </h1>
            <p className="mt-4 text-base max-w-md leading-relaxed text-brand-text-muted">
              Auth, billing, teams, and email already built and tested. You write the feature that makes your product unique.
            </p>

            {/* Feature highlights */}
            <div className="mt-10 space-y-4">
              {[
                { icon: Zap, title: 'Auth with OAuth, TOTP and sessions' },
                { icon: Shield, title: 'Stripe billing wired end-to-end' },
                { icon: Globe, title: 'Deploy anywhere in one command' },
              ].map(({ icon: Icon, title }) => (
                <div key={title} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 bg-brand-primary/10">
                    <Icon className="h-4 w-4 text-brand-primary" />
                  </div>
                  <span className="text-[13.5px] font-medium text-brand-text-muted">{title}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom stats */}
          <div className="flex gap-8 pt-6 border-t border-brand-border">
            {[
              { val: 'Auth', sub: 'OAuth + TOTP' },
              { val: 'Billing', sub: 'Stripe ready' },
              { val: 'Deploy', sub: 'One command' },
            ].map(({ val, sub }) => (
              <div key={val}>
                <div className="text-sm font-bold text-brand-text">{val}</div>
                <div className="text-[11px] text-brand-text-muted">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* -- Right Panel — form ------------------------------------------------ */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-[420px] space-y-6">
          {/* Brand — visible on mobile where left panel is hidden */}
          <div className="text-center lg:text-left">
            <Link to="/" className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight text-brand-text lg:hidden">
              <img src={info.logo} alt="" className="h-8 w-8" />
              {info.name}
            </Link>
            <p className="text-sm text-brand-text-muted lg:hidden mt-1 mb-4">
              {info.tagline}
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-brand-text">Forgot your password?</h2>
            <p className="mt-1 text-sm text-brand-text-muted">
              Enter your email and we'll send you a link to reset your password.
            </p>
          </div>

          {submitted ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="rounded-full bg-brand-surface p-3">
                  <Mail className="h-6 w-6 text-brand-text-muted" />
                </div>
                <p className="text-sm text-brand-text-muted">
                  If <span className="font-medium text-brand-text">{email}</span> is
                  registered, you'll receive a reset link shortly. Check your inbox
                  and spam folder.
                </p>
              </div>
              <Button asChild variant="outline" className="w-full h-11">
                <Link to="/auth">Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField label="Email" required>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </FormField>
              {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Sending...' : 'Send reset link'}
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link to="/auth">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to sign in
                </Link>
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
