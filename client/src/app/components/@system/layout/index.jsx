import { cn } from '@/app/lib/@system/utils'


export function PageLayout({ children, className = '' }) {
  return (
    <div className={cn('min-h-screen bg-brand-bg', className)}>
      {children}
    </div>
  )
}
