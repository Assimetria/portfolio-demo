import { cva } from 'class-variance-authority'
import { cn } from '@/app/lib/@system/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-brand-primary text-brand-text-on-primary hover:bg-brand-primary/80',
        secondary: 'border-transparent bg-brand-surface text-brand-text hover:bg-brand-surface/80',
        destructive: 'border-transparent bg-[var(--color-error)] text-[var(--color-error)]-foreground hover:bg-[var(--color-error)]/80',
        outline: 'text-brand-text border',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { badgeVariants }
