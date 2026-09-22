import { info } from '@/config'
import { isModuleEnabled } from '@/config/@system/modules'

/**
 * Drop route definitions whose optional `module` field names a feature module
 * that brand.json switches off (e.g. `{ path: '/pricing', module: 'billing' }`).
 * Routes without a `module` field are always kept. Applied to the @system route
 * table before mergeRoutes(), so @custom routes can still re-add a path.
 */
export function filterRoutesByModules(routes, isEnabled = isModuleEnabled) {
  return routes.filter((r) => !r.module || isEnabled(r.module))
}

export function mergeRoutes(systemRoutes, customRoutes) {
  if (!customRoutes || customRoutes.length === 0) return systemRoutes
  const merged = new Map()
  for (const route of systemRoutes) merged.set(route.path, route)
  for (const route of customRoutes) {
    const existing = merged.get(route.path)
    if (existing && route.children && existing.children) {
      merged.set(route.path, { ...existing, ...route, children: mergeRoutes(existing.children, route.children) })
    } else {
      merged.set(route.path, route)
    }
  }
  return Array.from(merged.values())
}

export function isRouteLocked(pathname, userPlan) {
  if (!pathname) return false
  const plans = info.plans
  if (!plans || !Array.isArray(plans)) return false
  const plan = userPlan
    ? plans.find(p => p.name === userPlan || p.priceId === userPlan)
    : plans[0]
  if (!plan || !plan.noAllowedRoutes || plan.noAllowedRoutes.length === 0) return false
  return plan.noAllowedRoutes.some(locked => {
    if (locked === pathname) return true
    if (locked.endsWith('/*')) {
      const prefix = locked.slice(0, -2)
      return pathname === prefix || pathname.startsWith(prefix + '/')
    }
    return false
  })
}
