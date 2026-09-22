// @system — alert / callout component with semantic variants
import { cva } from 'class-variance-authority'
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/app/lib/@system/utils'
import { useState } from 'react'

const alertVariants = cva(
  // Mobile-first responsive padding
  'relative flex items-start gap-3 sm:gap-3 rounded-lg border p-4 sm:p-4 text-sm sm:text-sm',
  {
    variants: {
      variant: {
        default: 'bg-brand-bg border-[var(--brand-border-subtle)] text-brand-text',
        info: 'bg-[var(--color-info-bg)] dark:bg-[var(--color-info-bg)]/30 border-[var(--color-info)] dark:border-[var(--color-info)] text-[var(--color-info)] dark:text-[var(--color-info)]',
        success: 'bg-[var(--color-success-bg)] dark:bg-[var(--color-success-bg)]/30 border-[var(--color-success)] dark:border-[var(--color-success)] text-[var(--color-success)] dark:text-[var(--color-success)]',
        warning: 'bg-[var(--color-warning-bg)] dark:bg-[var(--color-warning-bg)]/30 border-[var(--color-warning)] dark:border-[var(--color-warning)] text-[var(--color-warning)] dark:text-[var(--color-warning)]',
        destructive: 'bg-[var(--color-error-bg)] dark:bg-[var(--color-error-bg)]/30 border-[var(--color-error)] dark:border-[var(--color-error)] text-[var(--color-error)] dark:text-[var(--color-error)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

const ICONS = {
  default: AlertCircle,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: AlertCircle,
}

export function Alert({ className, variant = 'default', title, dismissible, onClose, children, ...props }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  const Icon = ICONS[variant ?? 'default']

  function handleDismiss() {
    setDismissed(true)
    if (onClose) onClose()
  }

  return (
    <div className={cn(alertVariants({ variant }), className)} role="alert" {...props}>
      {/* Mobile-optimized icon sizing */}
      <Icon className="h-5 w-5 sm:h-4 sm:w-4 mt-0.5 flex-shrink-0" />
      <div className="flex-1 space-y-1">
        {title && <p className="font-semibold text-sm sm:text-sm">{title}</p>}
        {children && <div className="text-sm sm:text-sm opacity-90">{children}</div>}
      </div>
      {(dismissible || onClose) && (
        <button
          onClick={handleDismiss}
          className={cn(
            'flex-shrink-0 opacity-70 hover:opacity-100 active:opacity-100 transition-opacity',
            'touch-target min-h-touch min-w-touch flex items-center justify-center',
            '-mr-2 sm:-mr-1',
          )}
          aria-label="Dismiss alert"
        >
          <X className="h-5 w-5 sm:h-4 sm:w-4" />
        </button>
      )}
    </div>
  )
}
