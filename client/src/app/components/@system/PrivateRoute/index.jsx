import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/app/hooks/@system/useAuth'
import { Spinner } from '../Loading'


/**
 * @system — wraps any route that requires authentication.
 * Shows a spinner while the session is being verified.
 * Redirects to /auth if the user is not authenticated.
 * Optionally enforces a role (admin/user); redirects to /app on mismatch.
 *
 * Usage:
 *   <Route path="/app/foo" element={<PrivateRoute><FooPage /></PrivateRoute>} />
 *   <Route path="/app/admin-only" element={<PrivateRoute role="admin"><AdminPage /></PrivateRoute>} />
 */
export function PrivateRoute({ children, role }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />
  }

  if (role === 'admin' && (user).role !== 'admin') {
    return <Navigate to="/app" replace />
  }

  return <>{children}</>
}
