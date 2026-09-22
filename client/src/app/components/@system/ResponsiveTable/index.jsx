// @system — Mobile-responsive table wrapper with horizontal scroll
import { cn } from '@/app/lib/@system/utils'

/**
 * ResponsiveTableWrapper
 * Wraps tables to enable horizontal scrolling on mobile devices
 * while maintaining full-width layout on desktop
 */
export function ResponsiveTableWrapper({ children, className }) {
  return (
    <div className={cn('w-full overflow-x-auto -mx-4 sm:mx-0', className)}>
      <div className="inline-block min-w-full align-middle px-4 sm:px-0">
        <div className="overflow-hidden border-y sm:border sm:rounded-lg">
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * Mobile-optimized table cell with responsive padding
 */
export function ResponsiveTableCell({ children, className, ...props }) {
  return (
    <td className={cn('px-3 sm:px-4 py-3 sm:py-4 text-sm', className)} {...props}>
      {children}
    </td>
  )
}

/**
 * Mobile-optimized table header cell with responsive padding
 */
export function ResponsiveTableHead({ children, className, ...props }) {
  return (
    <th
      className={cn(
        'px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-brand-text-muted uppercase tracking-wider',
        className
      )}
      {...props}
    >
      {children}
    </th>
  )
}
