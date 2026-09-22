// @system — shadcn/ui Textarea (pure HTML, no Radix)
import * as React from 'react'
import { cn } from '@/app/lib/@system/utils'

const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      'flex min-h-[80px] w-full rounded-md border border-brand-border bg-brand-bg px-3 py-2 text-sm ring-offset-brand-bg placeholder:text-brand-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    ref={ref}
    {...props}
  />
))
Textarea.displayName = 'Textarea'

export { Textarea }
