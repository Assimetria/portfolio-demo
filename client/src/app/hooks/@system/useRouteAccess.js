// @system — hook that checks whether the current route is accessible based on
// the user's subscription plan tier. Pure client hook (no DB / network).
// Used to gate at-custom (product) routes by plan — see routes/@custom GuardedRoute.
// Reference: Asymetric-Ventures/template useRouteAccess.js pattern.
import { useLocation } from 'react-router-dom'
import { useAuthContext } from '@/app/hooks/@system/useAuth'
import { isRouteLocked } from '@/app/routes/@system/utils'

/**
 * useRouteAccess
 * Determines whether the currently navigated route is unlocked for the signed-in
 * user's plan tier. Free/basic tiers are kept off pro-locked /app/* routes while
 * higher tiers, allowed (empty noAllowedRoutes) plans and opens fall through.
 * @returns {{ pathname: string, userPlan: string|null, isLocked: boolean }}
 */
export function useRouteAccess() {
  const { pathname } = useLocation()
  const { user } = useAuthContext()

  const userPlan = user?.subscription?.plan ?? user?.plan ?? null
  const isLocked = isRouteLocked(pathname, userPlan)

  return { pathname, userPlan, isLocked }
}

// Named alias kept in sync with the ticket title (useSubscriptionAccess): both
// names expose the same subscription-aware route-access primitive.
export const useSubscriptionAccess = useRouteAccess

