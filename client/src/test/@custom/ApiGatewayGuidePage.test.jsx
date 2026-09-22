// @custom — ApiGatewayGuidePage tests
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@/app/store/@custom/ThemeContext'
import ApiGatewayGuidePage from '@/app/pages/app/@custom/ApiGatewayGuidePage'

// Mock DashboardLayout context
vi.mock('@/app/components/@system/Dashboard', () => ({
  DashboardLayout: {
    Content: ({ children }) => <div data-testid="dashboard-content">{children}</div>,
  },
}))

const mockSteps = [
  {
    id: 'welcome',
    title: 'Welcome to API Gateway',
    description: 'Learn the basics of API Gateway.',
    details: 'API Gateway handles routing, auth, rate limiting.',
  },
  {
    id: 'authentication',
    title: 'Configure Authentication',
    description: 'Set up API keys and JWT-based auth.',
    details: 'Choose between API key or JWT-based auth.',
  },
  {
    id: 'rate-limiting',
    title: 'Set Up Rate Limiting',
    description: 'Protect your backend with rate limits.',
    details: 'Define rate limits per client or endpoint.',
  },
]

function renderWithProviders() {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        <ApiGatewayGuidePage />
      </ThemeProvider>
    </BrowserRouter>,
  )
}

describe('ApiGatewayGuidePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Default: successful response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          steps: mockSteps,
          progress: { completedSteps: [], totalSteps: mockSteps.length, startedAt: '2026-01-01' },
        }),
    })
  })

  it('renders loading state initially', () => {
    global.fetch = vi.fn(() => new Promise(() => {})) // never resolves
    renderWithProviders()
    // Just check that loading doesn't crash — the heading won't appear during loading
    expect(screen.queryByText('API Gateway Onboarding Guide')).not.toBeInTheDocument()
  })

  it('renders guide steps after loading', async () => {
    renderWithProviders()
    await waitFor(() => {
      expect(screen.getByText('API Gateway Onboarding Guide')).toBeInTheDocument()
    })
    expect(screen.getByText('Welcome to API Gateway')).toBeInTheDocument()
    expect(screen.getByText('Configure Authentication')).toBeInTheDocument()
    expect(screen.getByText('Set Up Rate Limiting')).toBeInTheDocument()
  })

  it('displays progress count', async () => {
    renderWithProviders()
    await waitFor(() => {
      expect(screen.getByText(/Progress: 0 of 3 steps/)).toBeInTheDocument()
    })
  })

  it('displays completion banner when all steps are done', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          steps: mockSteps,
          progress: { completedSteps: ['welcome', 'authentication', 'rate-limiting'], totalSteps: 3 },
        }),
    })
    renderWithProviders()
    await waitFor(() => {
      expect(screen.getByText('All steps completed!')).toBeInTheDocument()
    })
  })

  it('shows error state when fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
    renderWithProviders()
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('shows error banner when API returns non-ok status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' }),
    })
    renderWithProviders()
    await waitFor(() => {
      expect(screen.getByText('Failed to load guide')).toBeInTheDocument()
    })
  })

  it('marks a step as complete when button is clicked', async () => {
    const user = userEvent.setup()
    // First call returns guide, second call returns updated progress
    let callCount = 0
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              steps: mockSteps,
              progress: { completedSteps: [], totalSteps: mockSteps.length },
            }),
        })
      }
      // POST to mark progress
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            progress: { completedSteps: ['welcome'], totalSteps: mockSteps.length },
          }),
      })
    })
    renderWithProviders()
    await waitFor(() => {
      expect(screen.getByText('Welcome to API Gateway')).toBeInTheDocument()
    })
    const buttons = screen.getAllByRole('button', { name: /Mark Complete/i })
    await user.click(buttons[0])
    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeInTheDocument()
    })
  })

  it('shows restart button when at least one step is completed', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          steps: mockSteps,
          progress: { completedSteps: ['welcome'], totalSteps: mockSteps.length },
        }),
    })
    renderWithProviders()
    await waitFor(() => {
      expect(screen.getByText('Restart Guide')).toBeInTheDocument()
    })
  })

  it('resets progress when restart is clicked', async () => {
    const user = userEvent.setup()
    let callCount = 0
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              steps: mockSteps,
              progress: { completedSteps: ['welcome'], totalSteps: mockSteps.length },
            }),
        })
      }
      // POST to reset
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            progress: { completedSteps: [], totalSteps: mockSteps.length },
          }),
      })
    })
    renderWithProviders()
    await waitFor(() => {
      expect(screen.getByText('Restart Guide')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Restart Guide'))
    await waitFor(() => {
      expect(screen.getByText(/Progress: 0 of 3 steps/)).toBeInTheDocument()
    })
  })
})