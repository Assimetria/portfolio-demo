// @system — Admin inbox for contact form submissions.
// API: GET /api/contact → { data, pagination, unreadCount }
//      PATCH /api/contact/:id/read | /unread → { data: { id, readAt } }
//      DELETE /api/contact/:id → { message }   (GDPR erasure)
// Route: /app/contact (ProtectedRoute role="admin").
import { useCallback, useEffect, useState } from 'react'
import { Inbox, Mail, MailOpen, Phone, ChevronLeft, ChevronRight, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '../../../../components/@system/ui/button'
import { Card, CardContent } from '../../../../components/@system/Card'
import { Sidebar } from '../../../../components/@system/Sidebar'
import { PageLayout } from '../../../../components/@system/PageLayout'
import { api } from '../../../../lib/@system/api'
import { cn } from '../../../../lib/@system/utils'

const PAGE_SIZE = 25

function fmtDate(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtDay(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function ContactSubmissionsPage() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('') // '' | 'true' (unread) | 'false' (read)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const q = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (filter) q.set('unread', filter)
      const res = await api.get(`/contact?${q.toString()}`)
      setItems(res.data ?? [])
      setTotal(res.pagination?.total ?? 0)
      setUnreadCount(res.unreadCount ?? 0)
    } catch (err) {
      setError(err.message || 'Failed to load submissions')
    } finally {
      setLoading(false)
    }
  }, [page, filter])

  useEffect(() => {
    load()
  }, [load])

  function applyReadAt(id, readAt) {
    setItems((list) => list.map((s) => (s.id === id ? { ...s, readAt } : s)))
  }

  async function toggleOpen(sub) {
    const next = openId === sub.id ? null : sub.id
    setOpenId(next)
    setConfirmDeleteId(null)
    if (next && !sub.readAt) {
      try {
        const res = await api.patch(`/contact/${sub.id}/read`, {})
        applyReadAt(sub.id, res.data?.readAt ?? new Date().toISOString())
        setUnreadCount((n) => Math.max(0, n - 1))
      } catch {
        /* leave as unread; user can retry by reopening */
      }
    }
  }

  async function markUnread(sub) {
    setBusyId(sub.id)
    try {
      await api.patch(`/contact/${sub.id}/unread`, {})
      applyReadAt(sub.id, null)
      setUnreadCount((n) => n + 1)
      setOpenId(null)
    } catch (err) {
      setError(err.message || 'Failed to mark as unread')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(sub) {
    setBusyId(sub.id)
    try {
      await api.delete(`/contact/${sub.id}`)
      setItems((list) => list.filter((s) => s.id !== sub.id))
      setTotal((n) => Math.max(0, n - 1))
      if (!sub.readAt) setUnreadCount((n) => Math.max(0, n - 1))
      setOpenId(null)
      setConfirmDeleteId(null)
    } catch (err) {
      setError(err.message || 'Failed to delete submission')
    } finally {
      setBusyId(null)
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <PageLayout>
      <Sidebar />
      <main id="main-content" className="flex-1 p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Contact inbox</h1>
            <p className="mt-1 text-sm text-brand-text-muted">
              Messages sent through the website contact form.
              {unreadCount > 0 && <span className="ml-2 rounded-full bg-brand-primary/15 px-2 py-0.5 text-xs font-semibold text-brand-primary">{unreadCount} unread</span>}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={cn('mr-1 h-4 w-4', loading && 'animate-spin')} aria-hidden="true" /> Refresh
          </Button>
        </div>

        <div className="mb-6 flex gap-1.5" role="tablist" aria-label="Filter submissions">
          {[
            ['', 'All'],
            ['true', 'Unread'],
            ['false', 'Read'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => {
                setFilter(value)
                setPage(1)
              }}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary',
                filter === value ? 'bg-brand-primary text-brand-text-on-primary' : 'bg-brand-surface text-brand-text-muted hover:bg-brand-surface-hover/80',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-md border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 p-3 text-sm">
            {error}
          </p>
        )}

        {loading ? (
          <div className="py-12 text-center text-brand-text-muted">Loading…</div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Inbox className="mx-auto mb-4 h-10 w-10 text-brand-text-muted" aria-hidden="true" />
              <p className="font-medium">No submissions{filter === 'true' ? ' unread' : ''} yet</p>
              <p className="mt-1 text-sm text-brand-text-muted">New messages from the contact form will appear here.</p>
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2" role="list">
            {items.map((s) => {
              const open = openId === s.id
              const unread = !s.readAt
              const busy = busyId === s.id
              return (
                <li key={s.id}>
                  <Card className={cn('transition-colors', unread && 'border-brand-primary/50')}>
                    <button
                      type="button"
                      onClick={() => toggleOpen(s)}
                      aria-expanded={open}
                      className="flex w-full items-start gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded-[inherit]"
                    >
                      {unread ? <Mail className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary" aria-label="Unread" /> : <MailOpen className="mt-0.5 h-5 w-5 shrink-0 text-brand-text-muted" aria-label="Read" />}
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span className={cn('truncate', unread ? 'font-semibold' : 'font-medium')}>
                            {s.name} <span className="font-normal text-brand-text-muted">&lt;{s.email}&gt;</span>
                          </span>
                          <time dateTime={s.createdAt} className="text-xs text-brand-text-muted">
                            {fmtDate(s.createdAt)}
                          </time>
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-brand-text-secondary">{s.subject || s.message.slice(0, 120)}</span>
                      </span>
                    </button>
                    {open && (
                      <CardContent className="border-t border-brand-border pt-4">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{s.message}</p>
                        <dl className="mt-4 grid gap-2 text-xs text-brand-text-muted sm:grid-cols-2">
                          {s.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                              <dt className="sr-only">Phone</dt>
                              <dd>
                                <a href={`tel:${s.phone}`} className="hover:underline">
                                  {s.phone}
                                </a>
                              </dd>
                            </div>
                          )}
                          {s.sourcePath && (
                            <div>
                              <dt className="inline">Page: </dt>
                              <dd className="inline">{s.sourcePath}</dd>
                            </div>
                          )}
                          {s.readAt && (
                            <div>
                              <dt className="inline">Read: </dt>
                              <dd className="inline">{fmtDate(s.readAt)}</dd>
                            </div>
                          )}
                          {s.retentionExpiresAt && (
                            <div>
                              <dt className="inline">Auto-deletes: </dt>
                              <dd className="inline">{fmtDay(s.retentionExpiresAt)}</dd>
                            </div>
                          )}
                        </dl>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <Button asChild size="sm">
                            <a href={`mailto:${s.email}?subject=${encodeURIComponent(`Re: ${s.subject || 'your message'}`)}`}>Reply by email</a>
                          </Button>
                          {s.readAt && (
                            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => markUnread(s)}>
                              <Mail className="mr-1 h-4 w-4" aria-hidden="true" /> Mark as unread
                            </Button>
                          )}
                          {confirmDeleteId === s.id ? (
                            <span className="flex items-center gap-2 text-sm" role="group" aria-label="Confirm deletion">
                              <span className="text-brand-text-muted">Delete permanently?</span>
                              <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => remove(s)}>
                                Confirm delete
                              </Button>
                              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmDeleteId(null)}>
                                Cancel
                              </Button>
                            </span>
                          ) : (
                            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmDeleteId(s.id)} className="text-[var(--color-error)]">
                              <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" /> Delete
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                </li>
              )
            })}
          </ul>
        )}

        {pages > 1 && (
          <nav className="mt-6 flex items-center justify-between text-sm" aria-label="Pagination">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
            </Button>
            <span className="text-brand-text-muted">
              Page {page} of {pages} · {total} total
            </span>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </nav>
        )}
      </main>
    </PageLayout>
  )
}

export default ContactSubmissionsPage
