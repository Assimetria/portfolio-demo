// @system — Stat/metric card for dashboards
// Uses brand CSS variables. Compact density for modern dashboards.
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import { cn } from '@/app/lib/@system/utils'
import { Card, CardContent, CardHeader, CardDescription } from '../../Card'

export function StatCard({
  label,
  value,
  description,
  trend,
  icon: Icon,
  action,
  className,
  loading = false,
}) {
  if (loading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardHeader>
          <div className="h-4 w-24 bg-[var(--brand-surface-hover)] rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-7 w-16 bg-[var(--brand-surface-hover)] rounded mb-2" />
          <div className="h-3 w-32 bg-[var(--brand-surface-hover)] rounded" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-start justify-between">
        <CardDescription className="font-medium">{label}</CardDescription>
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-primary)]/10">
            <Icon className="h-4 w-4 text-[var(--brand-primary)]" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold tracking-tight text-[var(--brand-text)]">{value}</p>
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-xs font-medium',
                trend.direction === 'up' ? 'text-emerald-500' : 'text-[var(--color-error)]'
              )}
            >
              {trend.direction === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {trend.value}%
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-[var(--brand-text-muted)] mt-1">{description}</p>
        )}
        {action && (
          <button
            onClick={action.onClick}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-primary)] hover:opacity-80 transition-opacity"
          >
            {action.label}
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </CardContent>
    </Card>
  )
}

export function StatCardGrid({ children, className, ...rest }) {
  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-5', className)} {...rest}>
      {children}
    </div>
  )
}
