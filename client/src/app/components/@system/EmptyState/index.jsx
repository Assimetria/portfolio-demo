// @system — reusable empty state component for pages with no data
import { FileQuestion } from 'lucide-react'
import { cn } from '@/app/lib/@system/utils'

/**
 * EmptyState — Display when no data is available
 * @param {Object} props
 * @param {React.ComponentType} [props.icon] - Lucide icon component (defaults to FileQuestion)
 * @param {string} props.title - Empty state title
 * @param {string} [props.description] - Optional description text
 * @param {React.ReactNode} [props.action] - Optional action button/element
 * @param {string} [props.className] - Additional CSS classes
 */
export function EmptyState({ 
  icon: Icon = FileQuestion, 
  title, 
  description, 
  action, 
  className 
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 sm:py-16 px-4 text-center', className)}>
      <div className="rounded-full bg-brand-surface p-3 sm:p-4 mb-3 sm:mb-4">
        <Icon className="h-6 w-6 sm:h-8 sm:w-8 text-brand-text-muted" />
      </div>
      <h3 className="text-sm sm:text-base font-semibold text-brand-text mb-1">{title}</h3>
      {description && (
        <p className="text-xs sm:text-sm text-brand-text-muted max-w-sm mb-4">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
