// @custom — ActivityPage drag-and-drop tests (SV4-112)
import { render, screen, waitFor } from '../test-utils'

// Mock @hello-pangea/dnd
jest.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children, onDragEnd }) => {
    // Store the onDragEnd callback so tests can invoke it
    if (typeof window !== 'undefined') {
      window.__dragEndHandler = onDragEnd
    }
    return <div data-testid="drag-context">{children}</div>
  },
  Droppable: ({ children, droppableId }) => {
    if (typeof children === 'function') {
      return (
        <div data-testid={`droppable-${droppableId}`}>
          {children({ innerRef: { current: null }, droppableProps: {}, placeholder: null })}
        </div>
      )
    }
    return <div data-testid={`droppable-${droppableId}`}>{children}</div>
  },
  Draggable: ({ children, draggableId, index }) => {
    if (typeof children === 'function') {
      return (
        <div data-testid={`draggable-${draggableId}`}>
          {children(
            { innerRef: { current: null }, draggableProps: {}, dragHandleProps: {} },
            { isDragging: false },
          )}
        </div>
      )
    }
    return <div data-testid={`draggable-${draggableId}`}>{children}</div>
  },
}))

// Mock the dashboard layout
jest.mock('@/app/components/@system/Dashboard', () => {
  const Content = ({ children }) => <div data-testid="dashboard-content">{children}</div>
  const Layout = ({ children }) => <div>{children}</div>
  Layout.Content = Content
  return { DashboardLayout: Layout }
})

// Mock the auth context
jest.mock('@/app/store/@system/auth', () => ({
  useAuthContext: () => ({
    user: { id: 1, name: 'Test User', email: 'test@example.com' },
    loading: false,
    isAuthenticated: true,
  }),
}))

// Mock reorder API
jest.mock('@/app/api/@custom', () => ({
  reorderActivity: jest.fn().mockResolvedValue({ success: true }),
}))

import { ActivityPage } from '@/app/pages/@custom/ActivityPage'

// Mock fetch for activity API
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('ActivityPage drag-and-drop', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default: return mock events
    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/activity?limit=')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              events: [
                { id: 1, action: 'login', resource_type: 'auth', resource_id: null, created_at: new Date().toISOString() },
                { id: 2, action: 'update', resource_type: 'settings', resource_id: '123', created_at: new Date().toISOString() },
                { id: 3, action: 'create', resource_type: 'post', resource_id: '456', created_at: new Date().toISOString() },
              ],
              total: 3,
            }),
        })
      }
      if (url.includes('/api/activity/order')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ order: [] }),
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })
  })

  it('renders the activity page with event items', async () => {
    render(<ActivityPage />)

    await waitFor(() => {
      expect(screen.getByText('Signed in')).toBeInTheDocument()
    })

    expect(screen.getByText('Updated settings')).toBeInTheDocument()
    expect(screen.getByText('Created post')).toBeInTheDocument()
  })

  it('renders drag handles for each event', async () => {
    render(<ActivityPage />)

    await waitFor(() => {
      expect(screen.getByText('Signed in')).toBeInTheDocument()
    })

    const handles = screen.getAllByLabelText('Drag to reorder')
    expect(handles).toHaveLength(3)
  })

  it('renders the DragDropContext', async () => {
    render(<ActivityPage />)

    await waitFor(() => {
      expect(screen.getByTestId('drag-context')).toBeInTheDocument()
    })
  })

  it('shows loading state initially', () => {
    // Don't resolve fetch
    mockFetch.mockImplementation(() => new Promise(() => {}))

    render(<ActivityPage />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows empty state when no events', async () => {
    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/activity?limit=')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ events: [], total: 0 }),
        })
      }
      if (url.includes('/api/activity/order')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ order: [] }),
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })

    render(<ActivityPage />)

    await waitFor(() => {
      expect(screen.getByText('No activity yet')).toBeInTheDocument()
    })
  })

  it('shows pagination when total exceeds page size', async () => {
    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/activity?limit=')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              events: [
                { id: 1, action: 'login', resource_type: 'auth', resource_id: null, created_at: new Date().toISOString() },
              ],
              total: 50,
            }),
        })
      }
      if (url.includes('/api/activity/order')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ order: [] }) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })

    render(<ActivityPage />)

    await waitFor(() => {
      expect(screen.getByText('Previous')).toBeInTheDocument()
      expect(screen.getByText('Next')).toBeInTheDocument()
    })
  })
})