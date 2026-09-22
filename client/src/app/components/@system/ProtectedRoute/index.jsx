// @system — route guard that redirects unauthenticated users to /auth
// Also redirects new users (onboarding not complete) to /onboarding.
// Integrates isRouteLocked() for subscription-based feature gating.
// Includes RouteErrorBoundary to catch child component crashes and redirect
// to /auth instead of showing a blank white page (#31871).
import { Component } from 'react'
import { Navigate, useLocation, Link } from 'react-router-dom'
import { useAuthContext } from '@/app/store/@system/auth'
import { isRouteLocked } from '@/app/routes/@system/utils'
import { isModuleEnabled } from '@/config/@system/modules'
import { Spinner } from '../Loading'
import { EmailVerificationBanner } from '../EmailVerificationBanner'
import { Lock, AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '../ui/button'


function LockedRoutePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-surface mb-6">
        <Lock className="h-8 w-8 text-brand-text-muted" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Feature locked</h1>
      <p className="text-brand-text-muted max-w-md mb-6">
        This feature is not available on your current plan. Upgrade to unlock access.
      </p>
      {isModuleEnabled('billing') && (
        <Button asChild>
          <Link to="/app/billing">View plans</Link>
        </Button>
      )}
    </div>
  )
}

/**
 * Error boundary that catches crashes inside protected route children.
 * Instead of showing a blank white page (React error #130), it shows
 * a recovery UI with a retry button and a link back to /auth.
 */
class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ProtectedRoute] child component crashed:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  handleSignOut = () => {
    // Navigate to auth — use window.location so we fully reset React state
    window.location.href = '/auth'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-error-bg)] mb-6">
            <AlertTriangle className="h-8 w-8 text-[var(--color-error)]" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-brand-text-muted max-w-md mb-6">
            This page failed to load. Try refreshing, or sign in again if the problem persists.
          </p>
          <div className="flex gap-3">
            <Button onClick={this.handleRetry} variant="default" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
            <Button onClick={this.handleSignOut} variant="outline">
              Sign in again
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export function ProtectedRoute({ children, role }) {
  const { user, loading, isAuthenticated } = useAuthContext()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />
  }

  // Redirect new users to /onboarding before they reach the rest of the app.
  // Skip when already there to avoid a redirect loop. (The old target,
  // /app/claim-team, was a KickOff-specific route that does not exist here.)
  // Only when the onboarding feature module is on — otherwise /onboarding is
  // not routed and every user would bounce into the 404 page.
  if (isModuleEnabled('onboarding') && user && user.onboardingCompleted === false && !location.pathname.startsWith('/onboarding')) {
    return <Navigate to="/onboarding" replace />
  }

  if (role === 'admin' && user?.role !== 'admin') {
    return <Navigate to="/app" replace />
  }

  // Subscription-based route gating via isRouteLocked()
  const userPlan = user?.subscription?.plan ?? user?.plan ?? null
  if (isRouteLocked(location.pathname, userPlan)) {
    return <LockedRoutePage />
  }

  return (
    <>
      <EmailVerificationBanner />
      <RouteErrorBoundary>{children}</RouteErrorBoundary>
    </>
  )
}
