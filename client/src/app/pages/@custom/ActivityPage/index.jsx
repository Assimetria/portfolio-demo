// @custom — activity feed page with drag-and-drop reorder (SV4-112)
import { useState, useEffect, useCallback } from 'react'
import { Activity, LogIn, Settings, CreditCard, Key, Users, FileText, RefreshCw, GripVertical } from 'lucide-react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { DashboardLayout } from '../../../components/@system/Dashboard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/@system/Card'
import { EmptyState } from '../../../components/@system/EmptyState'
import { Button } from '../../../components/@system/ui/button'
import { reorderActivity } from '../../../api/@custom'

const ICON_MAP = {
  login: LogIn,
  update: Settings,
  payment: CreditCard,
  api_key: Key,
  team: Users,
  post: FileText,
}

function formatTimeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

function describeEvent(event) {
  const action = event.action || ''
  const resource = event.resource_type || ''
  const labels = {
    login: 'Signed in',
    logout: 'Signed out',
    create: `Created ${resource}`,
    update: `Updated ${resource}`,
    delete: `Deleted ${resource}`,
  }
  return labels[action] || `${action} ${resource}`.trim()
}

export function ActivityPage() {
  const [events, setEvents] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [reordering, setReordering] = useState(false)

  const PAGE_SIZE = 30

  const fetchEvents = useCallback(async (offset = 0) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/activity?limit=${PAGE_SIZE}&offset=${offset}`, { credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()

      try {
        const orderRes = await fetch('/api/activity/order', { credentials: 'include' })
        if (orderRes.ok) {
          const { order } = await orderRes.json()
          if (order && order.length > 0) {
            const orderMap = new Map(order.map((o) => [o.id, o.position]))
            const ordered = [...data.events].sort((a, b) => {
              const posA = orderMap.get(a.id)
              const posB = orderMap.get(b.id)
              if (posA !== undefined && posB !== undefined) return posA - posB
              if (posA !== undefined) return -1
              if (posB !== undefined) return 1
              return 0
            })
            setEvents(ordered)
            setTotal(data.total || 0)
            return
          }
        }
      } catch { /* fallback */ }

      setEvents(data.events || [])
      setTotal(data.total || 0)
    } catch { /* silently fail */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchEvents(page * PAGE_SIZE)
  }, [fetchEvents, page])

  const handleDragEnd = useCallback(async (result) => {
    if (!result.destination) return

    const reordered = Array.from(events)
    const [removed] = reordered.splice(result.source.index, 1)
    reordered.splice(result.destination.index, 0, removed)

    setEvents(reordered)
    setReordering(true)

    try {
      const items = reordered.map((event, index) => ({
        id: event.id,
        position: index,
      }))
      await reorderActivity(items)
    } catch {
      fetchEvents(page * PAGE_SIZE)
    } finally {
      setReordering(false)
return (
    <DashboardLayout>
      <DashboardLayout.Content>
        <div className="mb-6 sm:mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Activity</h1>
            <p className="mt-1 text-brand-text-muted">
              A log of all actions and events on your account. Drag items to reorder.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => fetchEvents(page * PAGE_SIZE)}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Events</CardTitle>
            <CardDescription>All activity across your account, newest first. {total > 0 && `${total} total.`}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && events.length === 0 ? (
              <div className="py-8 text-center text-sm text-brand-text-muted">Loading...</div>
            ) : events.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No activity yet"
                description="Events will appear here once you start using the app."
              />
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="activity-list">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-1"
                    >
                      {events.map((event, index) => {
                        const Icon = ICON_MAP[event.resource_type] || ICON_MAP[event.action] || Activity
                        return (
                          <Draggable key={event.id} draggableId={String(event.id)} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                                  snapshot.isDragging
                                    ? 'bg-brand-surface-hover shadow-lg'
                                    : 'hover:bg-brand-surface-hover'
                                }`}
                              >
                                <div
                                  {...provided.dragHandleProps}
                                  className="flex h-8 w-8 shrink-0 items-center justify-center cursor-grab active:cursor-grabbing text-brand-text-muted hover:text-brand-text"
                                  aria-label="Drag to reorder"
                                >
                                  <GripVertical className="h-4 w-4" />
                                </div>
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-surface">
                                  <Icon className="h-4 w-4 text-brand-text-muted" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">{describeEvent(event)}</p>
                                  {event.resource_id && (
                                    <p className="text-xs text-brand-text-muted truncate">
                                      {event.resource_type} #{event.resource_id}
                                    </p>
                                  )}
                                </div>
                                <span className="text-xs text-brand-text-muted whitespace-nowrap">
                                  {formatTimeAgo(event.created_at)}
                                </span>
                              </div>
                            )}
                          </Draggable>
                        )
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}

            {total > PAGE_SIZE && !loading && (
              <div className="flex items-center justify-between pt-4 border-t mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-xs text-brand-text-muted">
                  Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(page + 1) * PAGE_SIZE >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}

            {reordering && (
              <div className="pt-2 text-xs text-center text-brand-text-muted">
                Saving order...
              </div>
            )}
          </CardContent>
        </Card>
      </DashboardLayout.Content>
    </DashboardLayout>
  )
}