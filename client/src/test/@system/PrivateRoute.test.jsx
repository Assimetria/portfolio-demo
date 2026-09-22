// @system — Tests for PrivateRoute guard (components/@system/PrivateRoute)
import { render, screen } from '../test-utils'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { PrivateRoute } from '@/app/components/@system/PrivateRoute'

// Mock useAuth hook
jest.mock('@/app/hooks/@system/useAuth', () => ({
  useAuth: jest.fn(),
}))

// Mock Loading spinner
jest.mock('@/app/components/@system/Loading', () => ({
  Spinner: () => <div data-testid="spinner">Loading</div>,
}))

const { useAuth } = require('@/app/hooks/@system/useAuth')

function renderPrivateRoute({ role, initialEntry = '/app' } = {}) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/app"
          element={
            <PrivateRoute role={role}>
              <div data-testid="private-content">Protected page</div>
            </PrivateRoute>
          }
        />
        <Route path="/auth" element={<div data-testid="auth-page">Auth</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('PrivateRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows spinner while loading', () => {
    useAuth.mockReturnValue({ user: null, loading: true })

    renderPrivateRoute()
    expect(screen.getByTestId('spinner')).toBeInTheDocument()
    expect(screen.queryByTestId('private-content')).not.toBeInTheDocument()
  })

  it('redirects to /auth when not authenticated', () => {
    useAuth.mockReturnValue({ user: null, loading: false })

    renderPrivateRoute()
    expect(screen.getByTestId('auth-page')).toBeInTheDocument()
    expect(screen.queryByTestId('private-content')).not.toBeInTheDocument()
  })

  it('renders children when authenticated', () => {
    useAuth.mockReturnValue({
      user: { id: 1, name: 'Alice', role: 'user' },
      loading: false,
    })

    renderPrivateRoute()
    expect(screen.getByTestId('private-content')).toBeInTheDocument()
  })

  it('blocks non-admin users from admin routes', () => {
    useAuth.mockReturnValue({
      user: { id: 1, name: 'Alice', role: 'user' },
      loading: false,
    })

    renderPrivateRoute({ role: 'admin' })
    expect(screen.queryByTestId('private-content')).not.toBeInTheDocument()
  })

  it('allows admin users on admin routes', () => {
    useAuth.mockReturnValue({
      user: { id: 1, name: 'Admin', role: 'admin' },
      loading: false,
    })

    renderPrivateRoute({ role: 'admin' })
    expect(screen.getByTestId('private-content')).toBeInTheDocument()
  })
})
