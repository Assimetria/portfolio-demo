// @system — textarea input primitive
import { cn } from '@/app/lib/@system/utils'


export function Textarea({ className, error, ...props }) {
  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-brand-border bg-brand-bg px-3 py-2 text-sm ring-offset-brand-bg placeholder:text-brand-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y',
        error && 'border-destructive',
        className
      )}
      {...props}
    />
  )
}
