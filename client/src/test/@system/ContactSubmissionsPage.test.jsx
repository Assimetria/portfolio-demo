// @system — ContactSubmissionsPage: reads the { data, pagination, unreadCount }
// envelope, marks read on open, mark-unread, and the two-step GDPR delete.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContactSubmissionsPage } from '@/app/pages/app/@system/ContactSubmissionsPage'

jest.mock('@/app/lib/@system/api', () => ({
  api: { get: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}))
// Layout chrome needs router/auth context that is irrelevant here.
jest.mock('@/app/components/@system/Sidebar', () => ({ Sidebar: () => null }))
jest.mock('@/app/components/@system/PageLayout', () => ({ PageLayout: ({ children }) => <div>{children}</div> }))

const { api } = require('@/app/lib/@system/api')

const ROWS = [
  { id: 1, name: 'Ana Silva', email: 'ana@example.com', phone: '+351 210', subject: 'Consultation', message: 'Hello, I would like to talk.', sourcePath: '/', createdAt: '2026-09-20T10:00:00.000Z', readAt: null, retentionExpiresAt: '2027-03-19T10:00:00.000Z' },
  { id: 2, name: 'Bruno', email: 'bruno@example.com', phone: null, subject: null, message: 'Second message here.', sourcePath: null, createdAt: '2026-09-19T10:00:00.000Z', readAt: '2026-09-19T11:00:00.000Z', retentionExpiresAt: null },
]

function envelope(rows = ROWS, unreadCount = 1) {
  return { data: rows, pagination: { total: rows.length, page: 1, pages: 1, limit: 25 }, unreadCount }
}

beforeEach(() => {
  jest.clearAllMocks()
  api.get.mockResolvedValue(envelope())
})

describe('ContactSubmissionsPage', () => {
  it('lists submissions from the envelope with the unread badge and never shows an IP', async () => {
    render(<ContactSubmissionsPage />)
    expect(await screen.findByText(/Ana Silva/)).toBeInTheDocument()
    expect(screen.getByText('1 unread')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/contact?page=1&limit=25')
    expect(screen.queryByText(/IP:/)).not.toBeInTheDocument()
  })

  it('filters by unread through the query string', async () => {
    const user = userEvent.setup()
    render(<ContactSubmissionsPage />)
    await screen.findByText(/Ana Silva/)
    await user.click(screen.getByRole('tab', { name: 'Unread' }))
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/contact?page=1&limit=25&unread=true'))
  })

  it('marks an unread submission read when opened and shows its retention date', async () => {
    const user = userEvent.setup()
    api.patch.mockResolvedValue({ data: { id: 1, readAt: '2026-09-20T12:00:00.000Z' } })
    render(<ContactSubmissionsPage />)
    await user.click(await screen.findByRole('button', { name: /Ana Silva/ }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/contact/1/read', {}))
    expect(screen.getByText('Hello, I would like to talk.')).toBeInTheDocument()
    expect(screen.getByText(/Auto-deletes:/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('1 unread')).not.toBeInTheDocument())
  })

  it('offers "Mark as unread" on read submissions', async () => {
    const user = userEvent.setup()
    api.patch.mockResolvedValue({ data: { id: 2, readAt: null } })
    render(<ContactSubmissionsPage />)
    await user.click(await screen.findByRole('button', { name: /Bruno/ }))
    expect(api.patch).not.toHaveBeenCalled() // already read — no PATCH on open
    await user.click(screen.getByRole('button', { name: /mark as unread/i }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/contact/2/unread', {}))
    expect(await screen.findByText('2 unread')).toBeInTheDocument()
  })

  it('deletes only after confirmation and removes the row', async () => {
    const user = userEvent.setup()
    api.patch.mockResolvedValue({ data: { id: 1, readAt: 'x' } })
    api.delete.mockResolvedValue({ message: 'Submission deleted' })
    render(<ContactSubmissionsPage />)
    await user.click(await screen.findByRole('button', { name: /Ana Silva/ }))

    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(api.delete).not.toHaveBeenCalled()
    const group = screen.getByRole('group', { name: /confirm deletion/i })
    await user.click(within(group).getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('group', { name: /confirm deletion/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    await user.click(within(screen.getByRole('group', { name: /confirm deletion/i })).getByRole('button', { name: /confirm delete/i }))
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/contact/1'))
    await waitFor(() => expect(screen.queryByText(/Ana Silva/)).not.toBeInTheDocument())
    expect(screen.getByText(/Bruno/)).toBeInTheDocument()
  })

  it('shows the API error message when loading fails', async () => {
    api.get.mockRejectedValueOnce(new Error('Contact form is temporarily unavailable'))
    render(<ContactSubmissionsPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/temporarily unavailable/i)
  })
})
