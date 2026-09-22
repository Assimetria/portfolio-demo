// @system — Email Logs tab for AdminPage
import {
  RefreshCw, ChevronLeft, ChevronRight,
  Mail, MailCheck, MailX, AlertTriangle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/@system/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../../components/@system/Table'
import { Button } from '../../../../components/@system/ui/button'
import { PAGE_SIZE, StatCard } from './parts'
import { formatDate } from './format'

export function EmailLogsTab({
  emailLogs, emailLogsTotal, emailLogsLoading, emailLogsError,
  emailLogsPage, setEmailLogsPage,
  emailStatusFilter, setEmailStatusFilter,
  emailStats,
  fetchEmailLogs,
}) {
  return (
    <div className="space-y-4">
      {/* Email stats cards */}
      {emailStats && (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          <StatCard icon={Mail} label="Total Emails" value={Number(emailStats.total ?? 0).toLocaleString()} loading={emailLogsLoading} />
          <StatCard icon={MailCheck} label="Delivered" value={Number(emailStats.delivered ?? 0).toLocaleString()} loading={emailLogsLoading} />
          <StatCard icon={MailX} label="Failed" value={Number(emailStats.failed ?? 0).toLocaleString()} loading={emailLogsLoading} />
          <StatCard icon={AlertTriangle} label="Bounced" value={Number(emailStats.bounced ?? 0).toLocaleString()} loading={emailLogsLoading} />
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle>Email Logs</CardTitle>
            <CardDescription>Transactional email delivery history.</CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={emailStatusFilter}
              onChange={e => {
                setEmailStatusFilter(e.target.value)
                setEmailLogsPage(1)
                fetchEmailLogs(1, e.target.value)
              }}
              className="h-8 rounded-md border border-brand-border bg-brand-bg px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
            >
              <option value="">All statuses</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
              <option value="bounced">Bounced</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchEmailLogs(emailLogsPage, emailStatusFilter)}
              disabled={emailLogsLoading}
              className="gap-2"
            >
              <RefreshCw className={`h-3 w-3 ${emailLogsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {emailLogsError && (
            <p className="text-sm text-[var(--color-error)] mb-4">{emailLogsError}</p>
          )}
          {emailLogsLoading ? (
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
                    <TableHead>Recipient</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Sent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm font-medium">{log.to_address}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{log.subject}</TableCell>
                      <TableCell>
                        {log.template ? (
                          <span className="inline-flex items-center rounded-full bg-brand-surface px-2 py-0.5 text-xs font-medium">
                            {log.template}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          log.status === 'delivered' ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)]/30 dark:text-[var(--color-success)]' :
                          log.status === 'sent' ? 'bg-[var(--color-info-bg)] text-[var(--color-info)] dark:bg-[var(--color-info-bg)]/30 dark:text-[var(--color-info)]' :
                          log.status === 'failed' ? 'bg-[var(--color-error-bg)] text-[var(--color-error)] dark:bg-[var(--color-error-bg)]/30 dark:text-[var(--color-error)]' :
                          log.status === 'bounced' ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] dark:bg-[var(--color-warning-bg)]/30 dark:text-[var(--color-warning)]' :
                          'bg-brand-surface text-brand-text-muted'
                        }`}>
                          {log.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-brand-text-muted">{log.provider ?? '—'}</TableCell>
                      <TableCell className="text-sm text-brand-text-muted">
                        {log.sent_at ? formatDate(log.sent_at) : formatDate(log.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!emailLogsLoading && emailLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-brand-text-muted py-8">
                        No email logs found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between text-sm text-brand-text-muted">
                <span>{emailLogsTotal} total emails</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={emailLogsPage <= 1}
                    onClick={() => {
                      const p = emailLogsPage - 1
                      setEmailLogsPage(p)
                      fetchEmailLogs(p, emailStatusFilter)
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-2">Page {emailLogsPage}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={emailLogs.length < PAGE_SIZE}
                    onClick={() => {
                      const p = emailLogsPage + 1
                      setEmailLogsPage(p)
                      fetchEmailLogs(p, emailStatusFilter)
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
    </div>
  )
}
