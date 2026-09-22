// @system — Tests for useNotifications hook (cookie-session auth + API mapping)
// Auth is an httpOnly cookie: every request must carry credentials: 'include'
// and must NOT read a bearer token from localStorage.
import { renderHook, act, waitFor } from '@testing-library/react'
import { useNotifications } from '@/app/hooks/@system/useNotifications'

const row = (id, over = {}) => ({
  id,
  title: `Title ${id}`,
  message: `Msg ${id}`,
  type: 'success',
  created_at: '2026-09-01T00:00:00Z',
  ...over,
})

function mockJsonOnce(value) {
  return jest.fn().mockResolvedValue({ ok: true, json: async () => value })
}

afterEach(() => {
  jest.restoreAllMocks()
  localStorage.clear()
})

describe('useNotifications', () => {
  it('fetches /api/notifications with cookie credentials and maps rows', async () => {
    const data = {
      notifications: [row(1, { seen_at: null }), row(2, { seen_at: new Date().toISOString(), type: 'warning' })],
      unreadCount: 1,
    }
    global.fetch = mockJsonOnce(data)

    const { result } = renderHook(() => useNotifications())

    await waitFor(() => expect(result.current.loading).toBe(false))

    // First notification unread, second read; fields mapped to UI shape.
    expect(result.current.unreadCount).toBe(1)
    expect(result.current.notifications).toEqual([
      expect.objectContaining({ id: 1, title: 'Title 1', description: 'Msg 1', variant: 'success', read: false }),
      expect.objectContaining({ id: 2, title: 'Title 2', variant: 'warning', read: true }),
    ])

    const call = global.fetch.mock.calls[0]
    expect(call[0]).toBe('/api/notifications?limit=50')
    expect(call[1].credentials).toBe('include')
    expect(call[1].headers?.Authorization).toBeUndefined()
  })

  it('markAllRead posts to /api/notifications/read-all and zeroes the counter', async () => {
    const data = { notifications: [row(7, { seen_at: null })], unreadCount: 1 }
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => data })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })

    const { result } = renderHook(() => useNotifications())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.markAllRead())

    const postCall = global.fetch.mock.calls.find(([url]) => url === '/api/notifications/read-all')
    expect(postCall[1].method).toBe('POST')
    expect(postCall[1].credentials).toBe('include')
    expect(result.current.unreadCount).toBe(0)
    expect(result.current.notifications.every((n) => n.read)).toBe(true)
  })

  it('survives a failing fetch without throwing', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useNotifications())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.notifications).toEqual([])
    expect(result.current.unreadCount).toBe(0)
  })
})
