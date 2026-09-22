// @system — Subscriptions tab for AdminPage
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/@system/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../../components/@system/Table'
import { Button } from '../../../../components/@system/ui/button'
import { PAGE_SIZE, StatusBadge } from './parts'
import { formatDate } from './format'

export function SubscriptionsTab({
  subscriptions, subsLoading, subsError,
  subsPage, setSubsPage,
  subsStatusFilter, setSubsStatusFilter,
  fetchSubscriptions,
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <CardTitle>Subscriptions</CardTitle>
          <CardDescription>Active and historical subscriptions.</CardDescription>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={subsStatusFilter}
            onChange={e => {
              setSubsStatusFilter(e.target.value)
              setSubsPage(1)
              fetchSubscriptions(1, e.target.value)
            }}
            className="h-8 rounded-md border border-brand-border bg-brand-bg px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="canceled">Canceled</option>
            <option value="past_due">Past due</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchSubscriptions(subsPage, subsStatusFilter)}
            disabled={subsLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-3 w-3 ${subsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {subsError && (
          <p className="text-sm text-[var(--color-error)] mb-4">{subsError}</p>
        )}
        {subsLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-brand-surface" />
            ))}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Ends / Renews</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{s.name ?? s.email}</div>
                      <div className="text-xs text-brand-text-muted">{s.email}</div>
                    </TableCell>
                    <TableCell className="text-sm">{s.plan_id ?? s.price_id ?? '—'}</TableCell>
                    <TableCell><StatusBadge status={s.status} /></TableCell>
                    <TableCell className="text-brand-text-muted text-sm">
                      {formatDate(s.created_at)}
                    </TableCell>
                    <TableCell className="text-brand-text-muted text-sm">
                      {formatDate(s.current_period_end ?? s.canceled_at)}
                    </TableCell>
                  </TableRow>
                ))}
                {!subsLoading && subscriptions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-brand-text-muted py-8">
                      No subscriptions found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between text-sm text-brand-text-muted">
              <span>Page {subsPage}</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={subsPage <= 1}
                  onClick={() => {
                    const p = subsPage - 1
                    setSubsPage(p)
                    fetchSubscriptions(p, subsStatusFilter)
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={subscriptions.length < PAGE_SIZE}
                  onClick={() => {
                    const p = subsPage + 1
                    setSubsPage(p)
                    fetchSubscriptions(p, subsStatusFilter)
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
