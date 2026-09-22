import * as React from 'react'
import { cn } from '@/app/lib/@system/utils'

const Input = React.forwardRef(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      'flex h-10 w-full rounded-md border border-brand-border bg-brand-bg px-3 py-2 text-sm ring-offset-brand-bg file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-brand-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    ref={ref}
    {...props}
  />
))
Input.displayName = 'Input'

export { Input }
