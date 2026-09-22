// @system — Overview tab for AdminPage
import { RefreshCw, Users, TrendingUp, UserCheck, CalendarDays } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/@system/Card'
import { Button } from '../../../../components/@system/ui/button'
import { StatCard } from './parts'

export function OverviewTab({ stats, statsLoading, statsError, onRefresh }) {
  return (
    <div className="space-y-6">
      {statsError && (
        <p className="text-sm text-[var(--color-error)]">{statsError}</p>
      )}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Total Users"
          value={stats?.total?.toLocaleString() ?? '—'}
          loading={statsLoading}
        />
        <StatCard
          icon={UserCheck}
          label="New Today"
          value={stats?.today?.toLocaleString() ?? '—'}
          loading={statsLoading}
        />
        <StatCard
          icon={TrendingUp}
          label="This Week"
          value={stats?.thisWeek?.toLocaleString() ?? '—'}
          loading={statsLoading}
        />
        <StatCard
          icon={CalendarDays}
          label="This Month"
          value={stats?.thisMonth?.toLocaleString() ?? '—'}
          loading={statsLoading}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Growth Metrics</CardTitle>
            <CardDescription>User registration trends.</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={statsLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-3 w-3 ${statsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-5 animate-pulse rounded bg-brand-surface" />
              ))}
            </div>
          ) : stats ? (
            <div className="space-y-3">
              {[
                { label: 'Today vs this week', a: stats.today, b: stats.thisWeek },
                { label: 'This week vs this month', a: stats.thisWeek, b: stats.thisMonth },
                { label: 'This month vs total', a: stats.thisMonth, b: stats.total },
              ].map(({ label, a, b }) => {
                const pct = b > 0 ? Math.round((a / b) * 100) : 0
                return (
                  <div key={label}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-brand-text-muted">{label}</span>
                      <span className="font-medium">{pct}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-brand-surface overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-primary transition-all"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-brand-text-muted text-center py-4">No data available.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
