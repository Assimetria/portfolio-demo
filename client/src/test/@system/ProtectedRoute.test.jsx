// @system — Tests for ProtectedRoute guard
import { render, screen } from '../test-utils'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '@/app/components/@system/ProtectedRoute'

// Mock auth store
jest.mock('@/app/store/@system/auth', () => ({
  useAuthContext: jest.fn(),
}))

// Mock child components
jest.mock('@/app/components/@system/Loading', () => ({
  Spinner: () => <div data-testid="spinner">Loading</div>,
}))

jest.mock('@/app/components/@system/EmailVerificationBanner', () => ({
  EmailVerificationBanner: () => null,
}))

const { useAuthContext } = require('@/app/store/@system/auth')

function renderProtectedRoute({ role, initialEntry = '/app' } = {}) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/app"
          element={
            <ProtectedRoute role={role}>
              <div data-testid="protected-content">Secret content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/auth" element={<div data-testid="auth-page">Auth</div>} />
        <Route path="/onboarding" element={<div data-testid="onboarding-page">Onboarding</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows spinner while loading', () => {
    useAuthContext.mockReturnValue({
      user: null,
      loading: true,
      isAuthenticated: false,
    })

    renderProtectedRoute()
    expect(screen.getByTestId('spinner')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('redirects to /auth when not authenticated', () => {
    useAuthContext.mockReturnValue({
      user: null,
      loading: false,
      isAuthenticated: false,
    })

    renderProtectedRoute()
    expect(screen.getByTestId('auth-page')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('renders children when authenticated', () => {
    useAuthContext.mockReturnValue({
      user: { id: 1, name: 'Alice', onboardingCompleted: true },
      loading: false,
      isAuthenticated: true,
    })

    renderProtectedRoute()
    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
  })

  it('redirects to /onboarding when onboarding not completed', () => {
    useAuthContext.mockReturnValue({
      user: { id: 1, name: 'Alice', onboardingCompleted: false },
      loading: false,
      isAuthenticated: true,
    })

    renderProtectedRoute()
    expect(screen.getByTestId('onboarding-page')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('blocks non-admin users from admin routes', () => {
    useAuthContext.mockReturnValue({
      user: { id: 1, name: 'Alice', role: 'user', onboardingCompleted: true },
      loading: false,
      isAuthenticated: true,
    })

    renderProtectedRoute({ role: 'admin' })
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('allows admin users on admin routes', () => {
    useAuthContext.mockReturnValue({
      user: { id: 1, name: 'Admin', role: 'admin', onboardingCompleted: true },
      loading: false,
      isAuthenticated: true,
    })

    renderProtectedRoute({ role: 'admin' })
    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
  })
})
