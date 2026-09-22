// @custom — HealthCheckPage tests
// Tests the health check dependencies page renders correctly,
// displays dependency statuses, and handles error/loading states.
import { render, screen, waitFor } from '../test-utils'
import userEvent from '@testing-library/user-event'
import * as healthApi from '@/app/api/@custom/health-check'
import { HealthCheckPage } from '@/app/pages/app/@custom/HealthCheckPage'

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/app/api/@custom/health-check', () => ({
  getHealthCheckDependencies: jest.fn(),
}))

// Dashboard barrel pulls in heavily-wired Sidebar/Menu components.
jest.mock('@/app/components/@system/Dashboard', () => {
  const Content = ({ children }) => <div data-testid="health-content">{children}</div>
  const Layout = ({ children }) => <div>{children}</div>
  Layout.Content = Content
  return { DashboardLayout: Layout }
})

jest.mock('@/app/store/@system/auth', () => ({
  useAuthContext: () => ({
    user: { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin' },
    loading: false,
    isAuthenticated: true,
  }),
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

function healthyResponse() {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: 3661,
    dependencies: [
      { name: 'database', status: 'healthy', latency_ms: 2 },
      { name: 'redis', status: 'healthy', latency_ms: 1 },
      { name: 'auth', status: 'healthy', latency_ms: 5 },
      { name: 'email', status: 'healthy', latency_ms: 0 },
      { name: 'storage', status: 'healthy', latency_ms: 0 },
    ],
    summary: { total: 5, healthy: 5, unhealthy: 0 },
  }
}

function degradedResponse() {
  return {
    status: 'degraded',
    timestamp: new Date().toISOString(),
    uptime: 120,
    dependencies: [
      { name: 'database', status: 'unhealthy', latency_ms: 50, error: 'Connection refused' },
      { name: 'redis', status: 'healthy', latency_ms: 1 },
      { name: 'auth', status: 'healthy', latency_ms: 5 },
      { name: 'email', status: 'healthy', latency_ms: 0 },
      { name: 'storage', status: 'healthy', latency_ms: 0 },
    ],
    summary: { total: 5, healthy: 4, unhealthy: 1 },
  }
}


// ── Tests ────────────────────────────────────────────────────────────────────

describe('HealthCheckPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows loading state initially', () => {
    healthApi.getHealthCheckDependencies.mockReturnValue(new Promise(() => {}))
    render(<HealthCheckPage />)
    expect(screen.getByText(/checking dependencies/i)).toBeInTheDocument()
  })

  it('renders healthy status with all dependencies', async () => {
    healthApi.getHealthCheckDependencies.mockResolvedValue(healthyResponse())
    render(<HealthCheckPage />)

    await waitFor(() => {
      expect(screen.getByTestId('overall-status')).toHaveTextContent(/system healthy/i)
    })

    expect(screen.getByTestId('healthy-count')).toHaveTextContent('5')
    expect(screen.getByTestId('unhealthy-count')).toHaveTextContent('0')
    expect(screen.getByTestId('total-count')).toHaveTextContent('5')

    expect(screen.getByTestId('dep-database')).toBeInTheDocument()
    expect(screen.getByTestId('dep-redis')).toBeInTheDocument()
    expect(screen.getByTestId('dep-auth')).toBeInTheDocument()
    expect(screen.getByTestId('dep-email')).toBeInTheDocument()
    expect(screen.getByTestId('dep-storage')).toBeInTheDocument()
  })

  it('renders degraded status with error for unhealthy dep', async () => {
    healthApi.getHealthCheckDependencies.mockResolvedValue(degradedResponse())
    render(<HealthCheckPage />)

    await waitFor(() => {
      expect(screen.getByTestId('overall-status')).toHaveTextContent(/system degraded/i)
    })

    expect(screen.getByTestId('healthy-count')).toHaveTextContent('4')
    expect(screen.getByTestId('unhealthy-count')).toHaveTextContent('1')
    expect(screen.getByText(/Connection refused/)).toBeInTheDocument()
  })

  it('shows error message when API call fails', async () => {
    healthApi.getHealthCheckDependencies.mockRejectedValue(new Error('Network error'))
    render(<HealthCheckPage />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(screen.getByText(/Network error/)).toBeInTheDocument()
  })

  it('has a refresh button that re-fetches data', async () => {
    healthApi.getHealthCheckDependencies.mockResolvedValue(healthyResponse())
    const user = userEvent.setup()
    render(<HealthCheckPage />)

    await waitFor(() => {
      expect(screen.getByTestId('overall-status')).toBeInTheDocument()
    })

    expect(healthApi.getHealthCheckDependencies).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /refresh/i }))

    await waitFor(() => {
      expect(healthApi.getHealthCheckDependencies).toHaveBeenCalledTimes(2)
    })
  })

  it('renders the page title', async () => {
    healthApi.getHealthCheckDependencies.mockResolvedValue(healthyResponse())
    render(<HealthCheckPage />)
    expect(screen.getByText('Service Health')).toBeInTheDocument()
  })

  it('shows uptime information', async () => {
    healthApi.getHealthCheckDependencies.mockResolvedValue(healthyResponse())
    render(<HealthCheckPage />)

    await waitFor(() => {
      expect(screen.getByText(/uptime/i)).toBeInTheDocument()
    })
    // 3661 seconds = 1h 1m
    expect(screen.getByText(/1h 1m/)).toBeInTheDocument()
  })
})
