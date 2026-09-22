// @system — Webhook management page
// Allows users to register, manage, and monitor webhook endpoints.
import { useState, useEffect } from 'react'
import {
  Webhook,
  Plus,
  Trash2,
  Play,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { DashboardLayout } from '../../../../components/@system/Dashboard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/@system/Card'
import { FormField, Input } from '../../../../components/@system/Form'
import { Button } from '../../../../components/@system/ui/button'
import { Modal } from '../../../../components/@system/Modal'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../../components/@system/Table'
import { Badge } from '../../../../components/@system/Badge'
import { webhooksApi } from '../../../../lib/@system/webhooks'

export function WebhooksPage() {
  const [webhooks, setWebhooks] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newEvents, setNewEvents] = useState([])
  const [newDescription, setNewDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [newSecret, setNewSecret] = useState(null)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [expandedId, setExpandedId] = useState(null)
  const [deliveries, setDeliveries] = useState({})

  useEffect(() => {
    fetchWebhooks()
    webhooksApi.getEvents().then(setEvents).catch(() => {})
  }, [])

  async function fetchWebhooks() {
    setLoading(true)
    setError('')
    try {
      const data = await webhooksApi.list()
      setWebhooks(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load webhooks')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!newUrl.trim()) { setCreateError('URL is required'); return }
    if (newEvents.length === 0) { setCreateError('Select at least one event'); return }
    setCreating(true)
    setCreateError('')
    try {
      const webhook = await webhooksApi.create({
        url: newUrl.trim(),
        events: newEvents,
        description: newDescription.trim() || undefined,
      })
      setNewSecret(webhook.secret)
      setWebhooks((prev) => [webhook, ...prev])
      setCreateOpen(false)
      setNewUrl('')
      setNewEvents([])
      setNewDescription('')
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create webhook')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await webhooksApi.remove(deleteTarget.id)
      setWebhooks((prev) => prev.filter((w) => w.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete webhook')
    } finally {
      setDeleting(false)
    }
  }

  async function handleToggle(webhook) {
    try {
      await webhooksApi.update(webhook.id, { active: !webhook.active })
      setWebhooks((prev) =>
        prev.map((w) => (w.id === webhook.id ? { ...w, active: !w.active } : w)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle webhook')
    }
  }

  async function handleTest(webhook) {
    try {
      await webhooksApi.test(webhook.id)
    } catch {
      // best-effort
    }
  }

  async function toggleDeliveries(webhookId) {
    if (expandedId === webhookId) {
      setExpandedId(null)
      return
    }
    setExpandedId(webhookId)
    if (!deliveries[webhookId]) {
      try {
        const data = await webhooksApi.getDeliveries(webhookId)
        setDeliveries((prev) => ({ ...prev, [webhookId]: data }))
      } catch {
        setDeliveries((prev) => ({ ...prev, [webhookId]: [] }))
      }
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <DashboardLayout>
      <DashboardLayout.Content className="max-w-4xl">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Webhooks</h1>
            <p className="mt-1 text-brand-text-muted">
              Receive real-time event notifications via HTTP callbacks.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Endpoint
          </Button>
        </div>

        {newSecret && (
          <div className="mb-6 rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 p-4">
            <p className="text-sm font-medium text-[var(--color-success)]">Webhook signing secret</p>
            <p className="mt-0.5 text-xs text-[var(--color-success)]">
              Use this secret to verify webhook signatures. It will only be shown once.
            </p>
            <div className="mt-3 flex items-center rounded-md border border-[var(--color-success)] bg-brand-bg px-3 py-2 font-mono text-xs break-all">
              <span className="flex-1 select-all">{newSecret}</span>
            </div>
            <button
              onClick={() => setNewSecret(null)}
              className="mt-2 text-xs text-[var(--color-success)] underline hover:no-underline"
            >
              Done
            </button>
          </div>
        )}

        {error && <p className="mb-4 text-sm text-[var(--color-error)]">{error}</p>}

        <Card>
          <CardHeader>
            <CardTitle>Your Endpoints</CardTitle>
            <CardDescription>
              Events are sent as POST requests with HMAC-SHA256 signatures.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-10 text-center text-sm text-brand-text-muted">Loading...</div>
            ) : webhooks.length === 0 ? (
              <div className="py-10 text-center">
                <Webhook className="mx-auto h-8 w-8 text-brand-text-muted/40" />
                <p className="mt-3 text-sm text-brand-text-muted">No webhook endpoints yet.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 gap-2"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Add your first endpoint
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {webhooks.map((wh) => (
                  <div key={wh.id} className="rounded-lg border">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <button
                        onClick={() => handleToggle(wh)}
                        className="shrink-0"
                        title={wh.active ? 'Disable' : 'Enable'}
                      >
                        {wh.active ? (
                          <ToggleRight className="h-5 w-5 text-[var(--color-success)]" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-brand-text-muted" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-xs truncate">{wh.url}</code>
                          <ExternalLink className="h-3 w-3 shrink-0 text-brand-text-muted" />
                        </div>
                        {wh.description && (
                          <p className="text-xs text-brand-text-muted mt-0.5">{wh.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(wh.events ?? []).map((ev) => (
                            <Badge key={ev} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {ev}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Send test event"
                          onClick={() => handleTest(wh)}
                        >
                          <Play className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Delivery log"
                          onClick={() => toggleDeliveries(wh.id)}
                        >
                          {expandedId === wh.id ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-[var(--color-error)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)]"
                          title="Delete"
                          onClick={() => setDeleteTarget(wh)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {expandedId === wh.id && (
                      <div className="border-t px-4 py-3 bg-brand-surface">
                        <p className="text-xs font-medium mb-2">Recent deliveries</p>
                        {(deliveries[wh.id] ?? []).length === 0 ? (
                          <p className="text-xs text-brand-text-muted">No deliveries yet.</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Event</TableHead>
                                <TableHead className="text-xs">Status</TableHead>
                                <TableHead className="text-xs">Duration</TableHead>
                                <TableHead className="text-xs">Time</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(deliveries[wh.id] ?? []).slice(0, 10).map((d) => (
                                <TableRow key={d.id}>
                                  <TableCell className="text-xs">{d.event}</TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={
                                        d.status && d.status >= 200 && d.status < 300
                                          ? 'default'
                                          : 'destructive'
                                      }
                                      className="text-[10px]"
                                    >
                                      {d.status ?? 'Error'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-brand-text-muted">
                                    {d.duration_ms != null ? `${d.duration_ms}ms` : '-'}
                                  </TableCell>
                                  <TableCell className="text-xs text-brand-text-muted">
                                    {formatDate(d.created_at)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </DashboardLayout.Content>

      {/* Create webhook modal */}
      <Modal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false)
          setNewUrl('')
          setNewEvents([])
          setNewDescription('')
          setCreateError('')
        }}
        title="Add Webhook Endpoint"
        description="We'll send a POST request with event data to your URL."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <FormField label="Endpoint URL">
            <Input
              type="url"
              placeholder="https://your-app.com/webhooks"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              autoFocus
            />
          </FormField>
          <FormField label="Events">
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {events.map((ev) => {
                const active = newEvents.includes(ev)
                return (
                  <button
                    key={ev}
                    type="button"
                    className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                      active
                        ? 'border-primary bg-brand-primary/10 text-brand-primary'
                        : 'border-brand-border text-brand-text-muted hover:border-primary/50'
                    }`}
                    onClick={() =>
                      setNewEvents((prev) =>
                        active ? prev.filter((e) => e !== ev) : [...prev, ev],
                      )
                    }
                  >
                    {ev}
                  </button>
                )
              })}
            </div>
          </FormField>
          <FormField label="Description (optional)">
            <Input
              placeholder="e.g. Production payment handler"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
          </FormField>
          {createError && <p className="text-sm text-[var(--color-error)]">{createError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? 'Creating...' : 'Create Endpoint'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Webhook"
        description={`Are you sure you want to delete the webhook for ${deleteTarget?.url}? This cannot be undone.`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
