// @custom — WebhookBenchmark component tests
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, waitFor } from '../test-utils'
import userEvent from '@testing-library/user-event'
import { WebhookBenchmark } from '@/app/pages/app/@custom/WebhookBenchmark'

// Mock DashboardLayout to avoid requiring Router context (useLocation)
jest.mock('@/app/components/@system/Dashboard', () => {
  const Content = ({ children }) => <div data-testid="dashboard-content">{children}</div>
  const Layout = ({ children }) => <div data-testid="dashboard-layout">{children}</div>
  Layout.Content = Content
  return { DashboardLayout: Layout }
})

// Mock the api module
jest.mock('@/app/lib/@system/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}))

import { api } from '@/app/lib/@system/api'

const mockBenchmarkResult = {
  ok: true,
  config: { rounds: 3, webhooks: 5, latencyMs: 50, errorRate: 0 },
  strategies: [
    { strategy: 'concurrent', round: 1, totalRequests: 5, totalDurationMs: 150, avgLatencyMs: 48, p50LatencyMs: 47, p95LatencyMs: 50, p99LatencyMs: 51, throughput: 33.33, successCount: 5, failedCount: 0, successRate: 100 },
    { strategy: 'sequential', round: 1, totalRequests: 5, totalDurationMs: 250, avgLatencyMs: 50, p50LatencyMs: 49, p95LatencyMs: 52, p99LatencyMs: 53, throughput: 20.0, successCount: 5, failedCount: 0, successRate: 100 },
    { strategy: 'batched', round: 1, totalRequests: 5, totalDurationMs: 200, avgLatencyMs: 49, p50LatencyMs: 48, p95LatencyMs: 51, p99LatencyMs: 52, throughput: 25.0, successCount: 5, failedCount: 0, successRate: 100 },
  ],
  summary: {
    concurrent: { avgTotalDurationMs: 150, avgLatencyMs: 48, avgThroughput: 33.33, avgSuccessRate: 100, rounds: 1 },
    sequential: { avgTotalDurationMs: 250, avgLatencyMs: 50, avgThroughput: 20.0, avgSuccessRate: 100, rounds: 1 },
    batched: { avgTotalDurationMs: 200, avgLatencyMs: 49, avgThroughput: 25.0, avgSuccessRate: 100, rounds: 1 },
  },
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('WebhookBenchmark', () => {
  it('renders the page header', async () => {
    render(<WebhookBenchmark />)
    expect(screen.getByText('Webhook Benchmark')).toBeInTheDocument()
    expect(screen.getByText(/Performance comparison of webhook dispatch strategies/)).toBeInTheDocument()
  })

  it('shows the benchmark configuration form', async () => {
    render(<WebhookBenchmark />)
    expect(screen.getByText('Benchmark Configuration')).toBeInTheDocument()
    expect(screen.getByLabelText('Rounds')).toBeInTheDocument()
    expect(screen.getByLabelText('Webhook Endpoints')).toBeInTheDocument()
    expect(screen.getByLabelText('Latency (ms)')).toBeInTheDocument()
    expect(screen.getByLabelText('Error Rate')).toBeInTheDocument()
    expect(screen.getByText('Run Benchmark')).toBeInTheDocument()
  })

  it('disables Run Benchmark button is not correct expectation pattern', async () => {
    render(<WebhookBenchmark />)
    expect(screen.getByText('Run Benchmark')).toBeInTheDocument()
  })

  it('runs benchmark and displays results', async () => {
    const user = userEvent.setup()
    api.get.mockResolvedValueOnce(mockBenchmarkResult)
    render(<WebhookBenchmark />)

    await user.click(screen.getByText('Run Benchmark'))

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/webhook-benchmark', expect.objectContaining({
        params: expect.objectContaining({
          rounds: 3,
          webhooks: 5,
          latencyMs: 50,
          errorRate: 0,
        }),
      }))
    })

    await waitFor(() => {
      expect(screen.getByText('Benchmark Results')).toBeInTheDocument()
    })
  })

  it('displays strategy names in results', async () => {
    const user = userEvent.setup()
    api.get.mockResolvedValueOnce(mockBenchmarkResult)
    render(<WebhookBenchmark />)

    await user.click(screen.getByText('Run Benchmark'))

    await waitFor(() => {
      expect(screen.getByText('concurrent')).toBeInTheDocument()
    })
    expect(screen.getByText('sequential')).toBeInTheDocument()
    expect(screen.getByText('batched')).toBeInTheDocument()
  })

  it('displays summary cards', async () => {
    const user = userEvent.setup()
    api.get.mockResolvedValueOnce(mockBenchmarkResult)
    render(<WebhookBenchmark />)

    await user.click(screen.getByText('Run Benchmark'))

    await waitFor(() => {
      expect(screen.getByText('150 ms')).toBeInTheDocument()
    })
    expect(screen.getByText('250 ms')).toBeInTheDocument()
    expect(screen.getByText('200 ms')).toBeInTheDocument()
  })

  it('displays benchmark error message', async () => {
    const user = userEvent.setup()
    api.get.mockRejectedValueOnce(new Error('Benchmark service unavailable'))
    render(<WebhookBenchmark />)

    await user.click(screen.getByText('Run Benchmark'))

    await waitFor(() => {
      expect(screen.getByText('Benchmark Error')).toBeInTheDocument()
    })
    expect(screen.getByText('Benchmark service unavailable')).toBeInTheDocument()
  })
})