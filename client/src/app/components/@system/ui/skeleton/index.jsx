// @system — shadcn/ui Skeleton (pure Tailwind, no Radix)
import { cn } from '@/app/lib/@system/utils'

function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-brand-surface', className)}
      {...props}
    />
  )
}

export { Skeleton }
