// @system — Breadcrumbs navigation component
// Shows current page hierarchy with clickable path
//
// Usage:
// <Breadcrumbs>
//   <BreadcrumbItem href="/app">Dashboard</BreadcrumbItem>
//   <BreadcrumbItem href="/app/settings">Settings</BreadcrumbItem>
//   <BreadcrumbItem>Profile</BreadcrumbItem>
// </Breadcrumbs>

import { ChevronRight, Home } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/app/lib/@system/utils'

/**
 * Breadcrumbs — Navigation breadcrumbs container
 * @param {Object} props
 * @param {React.ReactNode} props.children - Breadcrumb items
 * @param {string} [props.separator='/'] - Custom separator
 * @param {string} [props.className] - Additional CSS classes
 */
export function Breadcrumbs({
  children,
  separator = <ChevronRight className="h-4 w-4 text-brand-text-muted" />,
  className,
}) {
  const childrenArray = Array.isArray(children) ? children : [children]

  return (
    <nav
      className={cn('flex items-center gap-2 text-sm', className)}
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center gap-2">
        {childrenArray.map((child, index) => {
          const isLast = index === childrenArray.length - 1

          return (
            <li key={index} className="flex items-center gap-2">
              {child}
              {!isLast && <span className="shrink-0">{separator}</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/**
 * BreadcrumbItem — Individual breadcrumb link
 * @param {Object} props
 * @param {React.ReactNode} props.children - Item content
 * @param {string} [props.href] - Link destination (if not last item)
 * @param {React.ReactNode} [props.icon] - Leading icon
 * @param {string} [props.className] - Additional CSS classes
 */
export function BreadcrumbItem({
  children,
  href,
  icon,
  className,
}) {
  const content = (
    <span className="flex items-center gap-1.5">
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  )

  if (href) {
    return (
      <Link
        to={href}
        className={cn(
          'hover:text-brand-text text-brand-text-muted transition-colors',
          className
        )}
      >
        {content}
      </Link>
    )
  }

  return (
    <span className={cn('font-medium text-brand-text', className)}>
      {content}
    </span>
  )
}

/**
 * BreadcrumbsFromPath — Auto-generate breadcrumbs from current path
 * @param {Object} props
 * @param {string} props.basePath - Base path prefix (e.g., '/app')
 * @param {Object} [props.labels] - Custom labels for paths
 * @param {boolean} [props.showHome=true] - Show home icon for first item
 * @param {string} [props.className] - Additional CSS classes
 */
export function BreadcrumbsFromPath({
  basePath = '',
  labels = {},
  showHome = true,
  className,
}) {
  const path = window.location.pathname
  const segments = path
    .replace(basePath, '')
    .split('/')
    .filter(Boolean)

  // Generate label from segment
  const getLabel = (segment) => {
    if (labels[segment]) return labels[segment]
    // Convert kebab-case and snake_case to Title Case
    return segment
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  // Build href for segment
  const getHref = (index) => {
    const pathSegments = segments.slice(0, index + 1)
    return `${basePath}/${pathSegments.join('/')}`
  }

  return (
    <Breadcrumbs className={className}>
      {/* Home/Root */}
      <BreadcrumbItem
        href={basePath || '/'}
        icon={showHome ? <Home className="h-4 w-4" /> : null}
      >
        {showHome ? null : 'Home'}
      </BreadcrumbItem>

      {/* Path segments */}
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1
        return (
          <BreadcrumbItem
            key={segment}
            href={isLast ? undefined : getHref(index)}
          >
            {getLabel(segment)}
          </BreadcrumbItem>
        )
      })}
    </Breadcrumbs>
  )
}
