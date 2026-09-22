// @custom — CachingResearch page tests
// Tests the caching strategies research page renders correctly,
// displays all strategy cards, handles recommendation toggles,
// and manages error/loading states.
import { render, screen, waitFor } from '../../test-utils'
import userEvent from '@testing-library/user-event'
import * as cachingApi from '@/app/api/@custom/caching'
import { CachingResearch } from '@/app/pages/app/@custom/CachingResearch'

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/app/api/@custom/caching', () => ({
  getCachingStrategies: jest.fn(),
  getCachingRecommendation: jest.fn(),
}))

// Dashboard barrel pulls in heavily-wired Sidebar/Menu components.
jest.mock('@/app/components/@system/Dashboard', () => {
  const Content = ({ children }) => <div data-testid="caching-content">{children}</div>
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

// ── Fixtures ──────────────────────────────────────────────────────────────────

function strategiesResponse() {
  return {
    ok: true,
    count: 6,
    strategies: [
      {
        id: 'in-memory',
        name: 'In-Memory Server Cache',
        category: 'server',
        description: 'Store dashboard JSON responses in a process-level Map or NodeCache.',
        pros: ['Zero infrastructure', 'Sub-millisecond reads', 'Trivial to implement'],
        cons: ['Cache is lost on restart', 'Not shared across multiple processes', 'Memory grows'],
        freshness: 3,
        complexity: 1,
        infraCost: 1,
        requiresRedis: false,
        useCase: 'Single-process deployments',
      },
      {
        id: 'redis-cache',
        name: 'Redis Cache',
        category: 'infra',
        description: 'Store serialised dashboard responses in Redis keyed by user ID.',
        pros: ['Survives server restarts', 'Shared across all instances', 'Supports TTL'],
        cons: ['Requires a running Redis instance', 'Network round-trip adds latency'],
        freshness: 3,
        complexity: 3,
        infraCost: 3,
        requiresRedis: true,
        useCase: 'Multi-process deployments',
      },
      {
        id: 'http-cache',
        name: 'HTTP Cache-Control / CDN Caching',
        category: 'infra',
        description: 'Leverage Cache-Control headers to allow CDN caching.',
        pros: ['Offloads requests from server', 'Zero code changes'],
        cons: ['Per-user data must not be cached', 'Cache invalidation is hard'],
        freshness: 2,
        complexity: 1,
        infraCost: 1,
        requiresRedis: false,
        useCase: 'Semi-static dashboard sections',
      },
      {
        id: 'swr-server',
        name: 'Stale-While-Revalidate (Server-Side)',
        category: 'server',
        description: 'Serve cached data immediately, then asynchronously re-fetch.',
        pros: ['Lowest latency', 'Database gets one revalidation'],
        cons: ['Users may see stale data', 'Requires background job'],
        freshness: 4,
        complexity: 4,
        infraCost: 2,
        requiresRedis: false,
        useCase: 'Dashboard pages where absolute freshness is not critical',
      },
      {
        id: 'swr-client',
        name: 'Client-Side SWR / TanStack Query',
        category: 'client',
        description: 'The client fetches API, caches response in memory.',
        pros: ['Instant page transitions', 'Deduplicates concurrent requests'],
        cons: ['Cache is per-browser-tab', 'First visit shows loading'],
        freshness: 4,
        complexity: 2,
        infraCost: 1,
        requiresRedis: false,
        useCase: 'SPA dashboard where users navigate frequently',
      },
      {
        id: 'db-cache',
        name: 'Database Materialised Views',
        category: 'server',
        description: 'Pre-compute dashboard aggregates via PostgreSQL materialised views.',
        pros: ['Eliminates expensive aggregation queries', 'Database handles computation'],
        cons: ['Stale until REFRESH', 'Not suitable for per-user data'],
        freshness: 2,
        complexity: 4,
        infraCost: 1,
        requiresRedis: false,
        useCase: 'Global / tenant-level aggregate stats',
      },
    ],
  }
}

function recommendationResponse(hasRedis, isMultiProcess) {
  if (hasRedis && isMultiProcess) {
    return {
      ok: true,
      recommendation: {
        primary: { id: 'redis-cache', name: 'Redis Cache', category: 'infra' },
        secondary: { id: 'swr-client', name: 'Client-Side SWR / TanStack Query', category: 'client' },
        fallback: { id: 'in-memory', name: 'In-Memory Server Cache', category: 'server' },
      },
    }
  }
  if (!hasRedis && isMultiProcess) {
    return {
      ok: true,
      recommendation: {
        primary: { id: 'swr-client', name: 'Client-Side SWR / TanStack Query', category: 'client' },
        secondary: { id: 'http-cache', name: 'HTTP Cache-Control / CDN Caching', category: 'infra' },
        fallback: { id: 'in-memory', name: 'In-Memory Server Cache', category: 'server' },
      },
    }
  }
  return {
    ok: true,
    recommendation: {
      primary: { id: 'in-memory', name: 'In-Memory Server Cache', category: 'server' },
      secondary: { id: 'swr-client', name: 'Client-Side SWR / TanStack Query', category: 'client' },
      fallback: { id: 'swr-server', name: 'Stale-While-Revalidate (Server-Side)', category: 'server' },
    },
  }
}
// ── Tests ────────────────────────────────────────────────────────────────────

describe('CachingResearch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    cachingApi.getCachingStrategies.mockResolvedValue(strategiesResponse())
    cachingApi.getCachingRecommendation.mockResolvedValue(
      recommendationResponse(false, false)
    )
  })

  it('shows loading state initially', () => {
    cachingApi.getCachingStrategies.mockReturnValue(new Promise(() => {}))
    cachingApi.getCachingRecommendation.mockReturnValue(new Promise(() => {}))
    render(<CachingResearch />)
    expect(screen.getByText(/Caching Strategies/i)).toBeInTheDocument()
  })

  it('renders the page title', async () => {
    render(<CachingResearch />)
    expect(screen.getByText('Caching Strategies')).toBeInTheDocument()
  })

  it('renders all 6 strategy cards', async () => {
    render(<CachingResearch />)
    await waitFor(() => {
      expect(screen.getByTestId('strategy-in-memory')).toBeInTheDocument()
    })
    expect(screen.getByTestId('strategy-redis-cache')).toBeInTheDocument()
    expect(screen.getByTestId('strategy-http-cache')).toBeInTheDocument()
    expect(screen.getByTestId('strategy-swr-server')).toBeInTheDocument()
    expect(screen.getByTestId('strategy-swr-client')).toBeInTheDocument()
    expect(screen.getByTestId('strategy-db-cache')).toBeInTheDocument()
  })

  it('shows recommended badge on relevant strategies', async () => {
    render(<CachingResearch />)
    await waitFor(() => {
      // Default recommendation (no redis, single process) = in-memory primary, swr-client secondary, swr-server fallback
      expect(screen.getByTestId('recommended-badge-in-memory')).toBeInTheDocument()
    })
  })

  it('shows environment configuration toggles', async () => {
    render(<CachingResearch />)
    await waitFor(() => {
      expect(screen.getByTestId('has-redis-switch')).toBeInTheDocument()
    })
    expect(screen.getByTestId('multi-process-switch')).toBeInTheDocument()
  })

  it('shows recommendation panel with primary/secondary/fallback', async () => {
    render(<CachingResearch />)
    await waitFor(() => {
      expect(screen.getByTestId('recommendation-panel')).toBeInTheDocument()
    })
    expect(screen.getByText('Primary')).toBeInTheDocument()
    expect(screen.getByText('Secondary')).toBeInTheDocument()
    expect(screen.getByText('Fallback')).toBeInTheDocument()
  })
it('shows error message when API call fails', async () => {
    cachingApi.getCachingStrategies.mockRejectedValue(new Error('Network error'))
    render(<CachingResearch />)

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument()
    })
  })

  it('updates recommendation when toggling Redis switch', async () => {
    cachingApi.getCachingRecommendation
      .mockResolvedValueOnce(recommendationResponse(false, false)) // initial
      .mockResolvedValueOnce(recommendationResponse(true, false))  // after toggle

    render(<CachingResearch />)

    await waitFor(() => {
      expect(screen.getByTestId('recommendation-panel')).toBeInTheDocument()
    })

    // Toggle Redis on
    const redisSwitch = screen.getByTestId('has-redis-switch')
    const user = userEvent.setup()
    await user.click(redisSwitch)

    // Recommendation should have been called twice (initial + after toggle)
    await waitFor(() => {
      expect(cachingApi.getCachingRecommendation).toHaveBeenCalledTimes(2)
    })
  })

  it('updates recommendation when toggling Multi-Process switch', async () => {
    cachingApi.getCachingRecommendation
      .mockResolvedValueOnce(recommendationResponse(false, false)) // initial
      .mockResolvedValueOnce(recommendationResponse(false, true))  // after toggle

    render(<CachingResearch />)

    await waitFor(() => {
      expect(screen.getByTestId('recommendation-panel')).toBeInTheDocument()
    })

    // Toggle Multi-Process on
    const mpSwitch = screen.getByTestId('multi-process-switch')
    const user = userEvent.setup()
    await user.click(mpSwitch)

    await waitFor(() => {
      expect(cachingApi.getCachingRecommendation).toHaveBeenCalledTimes(2)
    })
  })

  it('has a refresh button that re-fetches recommendation', async () => {
    cachingApi.getCachingRecommendation
      .mockResolvedValueOnce(recommendationResponse(false, false))
      .mockResolvedValueOnce(recommendationResponse(false, false))

    render(<CachingResearch />)

    await waitFor(() => {
      expect(screen.getByTestId('recommendation-panel')).toBeInTheDocument()
    })

    // Count initial calls
    const callCount = cachingApi.getCachingRecommendation.mock.calls.length

    const user = userEvent.setup()
    await user.click(screen.getByTestId('refresh-recommendation'))

    await waitFor(() => {
      expect(cachingApi.getCachingRecommendation).toHaveBeenCalledTimes(callCount + 1)
    })
  })

  it('shows strategy count in the heading', async () => {
    render(<CachingResearch />)
    await waitFor(() => {
      expect(screen.getByText(/All Strategies \(6\)/)).toBeInTheDocument()
    })
  })
})