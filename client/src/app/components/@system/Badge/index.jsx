// @system — badge / pill component with semantic variants
import { cva } from 'class-variance-authority'
import { cn } from '@/app/lib/@system/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-brand-primary text-brand-text-on-primary',
        secondary: 'bg-brand-surface text-brand-text',
        success: 'bg-[var(--color-success-bg)] dark:bg-[var(--color-success-bg)]/40 text-[var(--color-success)] dark:text-[var(--color-success)]',
        outline: 'border border-primary text-brand-primary bg-brand-bg',
        destructive: 'bg-[var(--color-error-bg)] dark:bg-[var(--color-error-bg)]/40 text-[var(--color-error)] dark:text-[var(--color-error)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)


export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
