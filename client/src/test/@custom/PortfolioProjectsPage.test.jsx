import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PortfolioProjectsPage } from '@/app/pages/app/@custom/PortfolioProjectsPage'

// Mock DashboardLayout to avoid complex dependencies
vi.mock('@/app/components/@system/Dashboard', () => ({
  DashboardLayout: {
    Content: ({ children }) => <div data-testid="dashboard-content">{children}</div>,
  },
}))

// Mock LoadingSpinner
vi.mock('@/app/components/@custom/LoadingSpinner', () => ({
  LoadingSpinner: ({ label }) => <div data-testid="loading-spinner">{label}</div>,
}))

// Mock API functions
const mockProjects = [
  {
    id: 1,
    title: 'E-commerce Platform',
    description: 'A full-stack e-commerce platform built with React and Node.js',
    category: 'Web App',
    tags: ['react', 'node', 'postgres'],
    project_url: 'https://example.com/ecommerce',
    image_url: 'https://example.com/ecommerce.png',
    status: 'published',
    featured: true,
    sort_order: 1,
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
  },
  {
    id: 2,
    title: 'Mobile Dashboard',
    description: 'A mobile-first analytics dashboard',
    category: 'Mobile',
    tags: ['react-native', 'typescript'],
    project_url: null,
    image_url: null,
    status: 'draft',
    featured: false,
    sort_order: 2,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
  },
]

// Mock API module — factory is evaluated once when the module is loaded
const mockApi = {
  getPortfolioProjects: vi.fn(),
  createPortfolioProject: vi.fn(),
  updatePortfolioProject: vi.fn(),
  deletePortfolioProject: vi.fn(),
}
vi.mock('@/app/api/@custom', () => mockApi)

describe('PortfolioProjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially', () => {
    mockApi.getPortfolioProjects.mockImplementation(() => new Promise(() => {})) // never resolves
    render(<PortfolioProjectsPage />)
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('renders empty state when no projects exist', async () => {
    mockApi.getPortfolioProjects.mockResolvedValue({ projects: [] })
    render(<PortfolioProjectsPage />)
    await waitFor(() => {
      expect(screen.getByText('No projects yet')).toBeInTheDocument()
    })
  })

  it('renders project cards when projects exist', async () => {
    mockApi.getPortfolioProjects.mockResolvedValue({ projects: mockProjects })
    render(<PortfolioProjectsPage />)

    await waitFor(() => {
      expect(screen.getByText('E-commerce Platform')).toBeInTheDocument()
      expect(screen.getByText('Mobile Dashboard')).toBeInTheDocument()
    })

    expect(screen.getByText('Web App')).toBeInTheDocument()
    expect(screen.getByText('Mobile')).toBeInTheDocument()

    expect(screen.getByText('react')).toBeInTheDocument()
    expect(screen.getByText('react-native')).toBeInTheDocument()
  })

  it('shows error state when API fails', async () => {
    mockApi.getPortfolioProjects.mockRejectedValue({ body: { message: 'Failed to load' } })
    render(<PortfolioProjectsPage />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load')).toBeInTheDocument()
    })
  })

  it('opens the create form when New Project button is clicked', async () => {
    mockApi.getPortfolioProjects.mockResolvedValue({ projects: [] })
    render(<PortfolioProjectsPage />)

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    const newButton = screen.getByText('New Project')
    await userEvent.click(newButton)

    expect(screen.getByText('Fill in the details to add a new portfolio project.')).toBeInTheDocument()
    expect(screen.getByLabelText('Title *')).toBeInTheDocument()
  })

  it('disables submit button when title is empty', async () => {
    mockApi.getPortfolioProjects.mockResolvedValue({ projects: [] })
    render(<PortfolioProjectsPage />)

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('New Project'))
    const submitBtn = screen.getByText('Create')
    expect(submitBtn).toBeDisabled()
  })

  it('calls createPortfolioProject on form submit', async () => {
    mockApi.getPortfolioProjects.mockResolvedValue({ projects: [] })
    mockApi.createPortfolioProject.mockResolvedValue({ project: mockProjects[0] })

    render(<PortfolioProjectsPage />)

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('New Project'))
    await userEvent.type(screen.getByLabelText('Title *'), 'New Project Title')
    await userEvent.type(screen.getByLabelText('Description'), 'A new project description')
    await userEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(mockApi.createPortfolioProject).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'New Project Title', description: 'A new project description' })
      )
    })
  })
})