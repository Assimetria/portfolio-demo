// @system — Onboarding page
// Shown to first-time users immediately after registration.
// Renders the OnboardingWizard in a full-page centered layout.
// Route: /onboarding (public after auth — redirect handled internally)

import { lazy, Suspense } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthContext } from '@/app/store/@system/auth'
import { Spinner } from '../../../../components/@system/Loading'
import { info } from '@/config'

// Lazy-load the OnboardingWizard so framer-motion is NOT bundled into this chunk
// for unauthenticated users who will just be redirected to /auth.
const OnboardingWizard = lazy(() =>
  import('../../../../components/@system/OnboardingWizard').then((m) => ({
    default: m.OnboardingWizard }))
)

function WizardFallback() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Spinner />
    </div>
  )
}

export function OnboardingPage() {
  const { user, loading, isAuthenticated } = useAuthContext()

  // Still loading the session — show spinner
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  // Not logged in — redirect to auth
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  // Already completed onboarding — skip to app
  if (user?.onboardingCompleted) {
    return <Navigate to="/app" replace />
  }

  return (
    <div className="flex min-h-screen flex-col bg-brand-bg">
      {/* Minimal header — just the logo */}
      <header className="flex items-center px-6 py-5 border-b border-brand-border/40">
        <span className="inline-flex items-center gap-2 text-lg font-bold tracking-tight">
          <img src={info.logo} alt="" className="h-7 w-7" />
          {info.name}
        </span>
      </header>

      {/* Centered wizard */}
      <main id="main-content" className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg rounded-2xl border border-brand-border/60 bg-brand-surface p-8 shadow-sm">
          <Suspense fallback={<WizardFallback />}>
            <OnboardingWizard />
          </Suspense>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center px-6 py-4 text-xs text-brand-text-muted">
        <span>© {new Date().getFullYear()} {info.name}. All rights reserved.</span>
      </footer>
    </div>
  )
}
