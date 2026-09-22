// @system — Tests for auth context (store/@system/auth.jsx)
import { render, screen, waitFor } from '../test-utils'
import { AuthProvider, useAuthContext } from '@/app/store/@system/auth'

// Mock the API module
jest.mock('@/app/lib/@system/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}))

const { api } = require('@/app/lib/@system/api')

// Test component that exposes auth context
function AuthConsumer() {
  const { user, loading, isAuthenticated } = useAuthContext()
  if (loading) return <div>Loading...</div>
  return (
    <div>
      <span data-testid="auth">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</span>
      {user && <span data-testid="user-name">{user.name}</span>}
    </div>
  )
}

function LoginConsumer() {
  const { login, user } = useAuthContext()
  return (
    <div>
      <button onClick={() => login('test@test.com', 'pass')}>Login</button>
      {user && <span data-testid="user-email">{user.email}</span>}
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('starts in loading state then resolves', async () => {
    api.get.mockResolvedValue({ user: { id: 1, name: 'Alice' } })

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('auth')).toHaveTextContent('authenticated')
    })
  })

  it('sets unauthenticated when session fetch fails', async () => {
    api.get.mockRejectedValue(new Error('Unauthorized'))

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('auth')).toHaveTextContent('unauthenticated')
    })
  })

  it('calls GET /sessions/me on mount', async () => {
    api.get.mockResolvedValue({ user: null })

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/sessions/me')
    })
  })
})

describe('useAuthContext', () => {
  it('throws when used outside AuthProvider', () => {
    // Suppress console.error from React error boundary
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

    expect(() => render(<AuthConsumer />)).toThrow(
      'useAuthContext must be used inside <AuthProvider>'
    )

    consoleSpy.mockRestore()
  })
})
