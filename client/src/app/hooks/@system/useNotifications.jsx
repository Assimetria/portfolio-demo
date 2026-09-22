// @system — Hook for fetching and managing in-app notifications
// Connects the NotificationCenter component to the /api/notifications endpoints.

import { useState, useEffect, useCallback, useRef } from 'react'

const POLL_INTERVAL = 60_000 // 1 minute

export function useNotifications() {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=50', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setNotifications(
        (data.notifications || []).map((n) => ({
          id: n.id,
          title: n.title,
          description: n.message,
          variant: n.type || 'default',
          read: !!n.seen_at,
          timestamp: n.created_at,
        }))
      )
      setUnreadCount(data.unreadCount ?? 0)
    } catch {
      // silently fail — notifications are non-critical
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    intervalRef.current = setInterval(fetchNotifications, POLL_INTERVAL)
    return () => clearInterval(intervalRef.current)
  }, [fetchNotifications])

  const markRead = useCallback(async (id) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST', credentials: 'include' })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch {}
  }, [])

  const markAllRead = useCallback(async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' })
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {}
  }, [])

  const dismiss = useCallback(async (id) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE', credentials: 'include' })
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      setUnreadCount((c) => {
        const removed = notifications.find((n) => n.id === id)
        return removed && !removed.read ? Math.max(0, c - 1) : c
      })
    } catch {}
  }, [notifications])

  return { notifications, unreadCount, loading, markRead, markAllRead, dismiss, refresh: fetchNotifications }
}
