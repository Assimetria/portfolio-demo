// @system — data table primitives with mobile-responsive padding and overflow
import { cn } from '@/app/lib/@system/utils'

function Table({ className = '', ...props }) {
  return (
    <div className="mobile-table-wrapper">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  )
}

function TableHeader({ className = '', ...props }) {
  return <thead className={cn('[&_tr]:border-b', className)} {...props} />
}

function TableBody({ className = '', ...props }) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
}

function TableFooter({ className = '', ...props }) {
  return (
    <tfoot
      className={cn('border-t bg-brand-surface font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  )
}

function TableRow({ className = '', ...props }) {
  return (
    <tr
      className={cn(
        'border-b transition-colors hover:bg-brand-surface-hover data-[state=selected]:bg-brand-surface-hover',
        // Better touch feedback on mobile
        'active:bg-brand-surface-active',
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className = '', ...props }) {
  return (
    <th
      className={cn(
        // Mobile-responsive padding: smaller on mobile, standard on desktop
        'h-10 sm:h-12 px-3 sm:px-4 text-left align-middle font-medium text-brand-text-muted',
        // Responsive text size
        'text-xs sm:text-sm',
        '[&:has([role=checkbox])]:pr-0',
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className = '', ...props }) {
  return (
    <td
      className={cn(
        // Mobile-responsive padding
        'px-3 py-3 sm:px-4 sm:py-4 align-middle',
        // Responsive text size
        'text-xs sm:text-sm',
        '[&:has([role=checkbox])]:pr-0',
        className
      )}
      {...props}
    />
  )
}

function TableCaption({ className = '', ...props }) {
  return (
    <caption className={cn('mt-3 sm:mt-4 text-xs sm:text-sm text-brand-text-muted', className)} {...props} />
  )
}

export { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption }
