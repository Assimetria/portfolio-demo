// @system — Card primitives (shadcn/ui pattern)
// Uses brand CSS variables for consistent theming.
// Reduced padding (p-4 instead of p-6) for modern density.
import { cn } from '@/app/lib/@system/utils'

function Card({ className = '', ...props }) {
  return (
    <div
      className={cn(
        'rounded-lg bg-[var(--brand-surface)] text-[var(--brand-text)] shadow-sm',
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className = '', ...props }) {
  return <div className={cn('flex flex-col space-y-1 p-4 pb-2', className)} {...props} />
}

function CardTitle({ className = '', ...props }) {
  return (
    <h3 className={cn('text-base font-semibold leading-tight tracking-tight', className)} {...props} />
  )
}

function CardDescription({ className = '', ...props }) {
  return <p className={cn('text-sm text-[var(--brand-text-secondary)]', className)} {...props} />
}

function CardContent({ className = '', ...props }) {
  return <div className={cn('p-4 pt-0', className)} {...props} />
}

function CardFooter({ className = '', ...props }) {
  return <div className={cn('flex items-center p-4 pt-0', className)} {...props} />
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
