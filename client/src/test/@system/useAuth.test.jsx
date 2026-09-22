// @system — Tests for useAuth hook (hooks/@system/useAuth.js)
// useAuth re-exports useAuthContext from the consolidated auth store
// (store/@system/auth.jsx — cookie sessions via GET /api/sessions/me).
// These tests verify the re-export wiring and the AuthProvider.
import { render, screen, waitFor } from '../test-utils'
import { useAuth } from '@/app/hooks/@system/useAuth'
import { useAuthContext, AuthProvider } from '@/app/store/@system/auth'

// Mock api for AuthContext provider tests
jest.mock('@/app/lib/@system/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}))

const { api } = require('@/app/lib/@system/api')

describe('useAuth re-export', () => {
  it('is the same function as useAuthContext', () => {
    expect(useAuth).toBe(useAuthContext)
  })
})

// Test the AuthProvider (store/@system/auth.jsx)
function AuthConsumer() {
  const { user, loading, isAuthenticated } = useAuth()
  if (loading) return <div data-testid="loading">Loading</div>
  return (
    <div>
      <span data-testid="auth">{isAuthenticated ? 'yes' : 'no'}</span>
      {user && <span data-testid="name">{user.name}</span>}
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('fetches session on mount and exposes user', async () => {
    api.get.mockResolvedValue({ user: { id: 1, name: 'Bob' } })

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    )

    expect(screen.getByTestId('loading')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('auth')).toHaveTextContent('yes')
    })
    expect(screen.getByTestId('name')).toHaveTextContent('Bob')
    expect(api.get).toHaveBeenCalledWith('/sessions/me')
  })

  it('sets unauthenticated when session fetch fails', async () => {
    api.get.mockRejectedValue(new Error('401'))

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('auth')).toHaveTextContent('no')
    })
  })
})
