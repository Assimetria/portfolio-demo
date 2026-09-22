// @system — SecuritySettings tests
// Verifies the "Active sessions" section is wired to the live sessions API
// (GET /api/sessions) and that revoking a non-current session confirms then
// issues a DELETE for /api/sessions/:id. The API wrapper is exercised end to
// end by stubbing fetch, and the real (Radix) confirm dialog drives the flow.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '../test-utils'
import userEvent from '@testing-library/user-event'
import { SecuritySettings } from '@/app/components/@system/UserSettings/SecuritySettings'

const now = new Date()

const MOCK_SESSIONS = [
  {
    id: 'sess-1',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
    ipAddress: '203.0.113.10',
    createdAt: now.toISOString(),
    isCurrent: true,
  },
  {
    id: 'sess-2',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.2 Safari/605.1.15',
    ipAddress: '198.51.100.42',
    createdAt: new Date(now.getTime() - 60 * 1000).toISOString(),
    isCurrent: false,
  },
]

// A minimal Response-shaped object (jsdom puts no fetch/Response shims in scope).
function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ data: body }),
  }
}

const baseUser = () => ({ twoFactorEnabled: false, emailVerified: true })

function callsFor(fetchMock) {
  return fetchMock.mock.calls
}

describe('SecuritySettings – active sessions', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn(async () => jsonResponse({ sessions: MOCK_SESSIONS }))
    global.fetch = fetchMock
  })

  it('fetches live sessions from the sessions API on mount', async () => {
    render(<SecuritySettings user={baseUser()} onUpdate={vi.fn()} />)

    await waitFor(() => {
      expect(callsFor(fetchMock).some(([url]) => url === '/api/sessions')).toBe(true)
    })

    // both mock sessions render (labels derived from User-Agent)
    expect(await screen.findByText('Browser on Windows')).toBeInTheDocument()
    expect(screen.getByText('Safari on macOS')).toBeInTheDocument()
  })

  it('marks the current session and surfaces the revoke action on others', async () => {
    render(<SecuritySettings user={baseUser()} onUpdate={vi.fn()} />)

    await screen.findByText('Safari on macOS')
    expect(screen.getAllByText('Current')).toHaveLength(1)

    const rows = screen.getAllByRole('button', { name: /revoke/i })
    expect(rows).toHaveLength(1)
  })

  it('confirms then revokes a session via the server', async () => {
    const user = userEvent.setup()
    render(<SecuritySettings user={baseUser()} onUpdate={vi.fn()} />)
    await screen.findByText('Safari on macOS')

    fetchMock.mockClear()

    await user.click(screen.getByRole('button', { name: /revoke/i }))

    // confirmation dialog opens
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByRole('heading', { name: 'Revoke session' })).toBeInTheDocument()

    await user.click(await within(dialog).findByRole('button', { name: 'Revoke session' }))

    await waitFor(() => {
      expect(callsFor(fetchMock).some(([url]) => url === '/api/sessions/sess-2')).toBe(true)
    })

    // row disappears from the list
    await waitFor(() =>
      expect(screen.queryByText('Safari on macOS')).not.toBeInTheDocument(),
    )
  })
})

