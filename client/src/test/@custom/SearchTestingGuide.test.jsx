// @custom — SearchTestingGuide component tests
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, waitFor } from '../test-utils'
import userEvent from '@testing-library/user-event'
import { SearchTestingGuide } from '@/app/pages/app/@custom/SearchTestingGuide'

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

const mockConfig = {
  provider: 'none',
  health: {
    provider: 'none',
    configured: false,
    devMode: true,
  },
  healthAll: {
    none: { provider: 'none', configured: false, devMode: true },
    meilisearch: { provider: 'meilisearch', configured: false, packageAvailable: false },
    algolia: { provider: 'algolia', configured: false, packageAvailable: false },
  },
  sampleDocuments: [
    { id: 1, title: 'Getting Started Guide', description: 'Learn how to set up', category: 'docs', tags: ['beginner', 'setup'], price: 0 },
    { id: 2, title: 'API Reference', description: 'Complete API reference', category: 'docs', tags: ['api', 'reference'], price: 0 },
  ],
  sampleIndexes: ['products', 'docs', 'guides', 'plugins'],
}

const mockSearchResult = {
  ok: true,
  provider: 'none',
  query: { index: 'products', q: 'getting started', filters: undefined, sort: undefined, limit: 20, offset: 0, fields: undefined },
  result: {
    hits: [
      { id: 1, title: 'Getting Started Guide', category: 'docs', price: 0 },
      { id: 2, title: 'Advanced Configuration', category: 'docs', price: 0 },
    ],
    total: 2,
    page: 1,
    totalPages: 1,
    processingTimeMs: 12,
  },
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('SearchTestingGuide', () => {
  it('renders the page header and loads config on mount', async () => {
    api.get.mockResolvedValueOnce(mockConfig)
    render(<SearchTestingGuide />)
    expect(screen.getByText('Search Testing Guide')).toBeInTheDocument()
    expect(screen.getByText(/Interactive tool for testing/)).toBeInTheDocument()
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/search-test')
    })
  })

  it('shows provider status card after loading config', async () => {
    api.get.mockResolvedValueOnce(mockConfig)
    render(<SearchTestingGuide />)
    await waitFor(() => {
      expect(screen.getByText('Search Provider Status')).toBeInTheDocument()
    })
    expect(screen.getByText('Active Provider')).toBeInTheDocument()
    expect(screen.getByText('Not Configured')).toBeInTheDocument()
  })

  it('shows sample documents after loading config', async () => {
    api.get.mockResolvedValueOnce(mockConfig)
    render(<SearchTestingGuide />)
    await waitFor(() => {
      expect(screen.getByText('Sample Test Documents')).toBeInTheDocument()
    })
    expect(screen.getByText('Getting Started Guide')).toBeInTheDocument()
    expect(screen.getByText('API Reference')).toBeInTheDocument()
  })

  it('renders search form fields', async () => {
    api.get.mockResolvedValueOnce(mockConfig)
    render(<SearchTestingGuide />)
    await waitFor(() => {
      expect(screen.getByLabelText('Index *')).toBeInTheDocument()
    })
    expect(screen.getByLabelText('Query *')).toBeInTheDocument()
    expect(screen.getByLabelText(/Filters/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Sort/)).toBeInTheDocument()
    expect(screen.getByLabelText('Limit')).toBeInTheDocument()
    expect(screen.getByLabelText('Offset')).toBeInTheDocument()
    expect(screen.getByLabelText(/Fields to Retrieve/)).toBeInTheDocument()
  })

  it('shows available sample indexes', async () => {
    api.get.mockResolvedValueOnce(mockConfig)
    render(<SearchTestingGuide />)
    await waitFor(() => {
      expect(screen.getByText(/Available: products, docs/)).toBeInTheDocument()
    })
  })

  it('disables Run Test button when query is empty', async () => {
    api.get.mockResolvedValueOnce(mockConfig)
    render(<SearchTestingGuide />)
    await waitFor(() => {
      expect(screen.getByText('Run Test')).toBeInTheDocument()
    })
    expect(screen.getByText('Run Test').closest('button')).toBeDisabled()
  })

  it('executes search and displays results', async () => {
    const user = userEvent.setup()
    api.get.mockResolvedValueOnce(mockConfig)
    api.post.mockResolvedValueOnce(mockSearchResult)
    render(<SearchTestingGuide />)
    await waitFor(() => {
      expect(screen.getByLabelText('Query *')).toBeInTheDocument()
    })
    await user.type(screen.getByLabelText('Query *'), 'getting started')
    await user.click(screen.getByText('Run Test'))
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/search-test/run', expect.objectContaining({
        index: 'products',
        q: 'getting started',
      }))
    })
    await waitFor(() => {
      expect(screen.getByText('Search Results')).toBeInTheDocument()
    })
    // Use getAllByText since "Getting Started Guide" appears in both sample data and results
    const gettingStartedElements = screen.getAllByText('Getting Started Guide')
    expect(gettingStartedElements.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Advanced Configuration/)).toBeInTheDocument()
    expect(screen.getByText(/Total: 2/)).toBeInTheDocument()
    expect(screen.getByText(/12 ms/)).toBeInTheDocument()
  })

  it('displays error when config fetch fails', async () => {
    api.get.mockRejectedValueOnce(new Error('Network error'))
    render(<SearchTestingGuide />)
    await waitFor(() => {
      expect(screen.getByText('Configuration Error')).toBeInTheDocument()
    })
    expect(screen.getByText('Network error')).toBeInTheDocument()
  })

  it('displays search error message', async () => {
    const user = userEvent.setup()
    api.get.mockResolvedValueOnce(mockConfig)
    api.post.mockRejectedValueOnce(new Error('Search provider unavailable'))
    render(<SearchTestingGuide />)
    await waitFor(() => {
      expect(screen.getByLabelText('Query *')).toBeInTheDocument()
    })
    await user.type(screen.getByLabelText('Query *'), 'test')
    await user.click(screen.getByText('Run Test'))
    await waitFor(() => {
      expect(screen.getByText('Search Error')).toBeInTheDocument()
    })
    expect(screen.getByText('Search provider unavailable')).toBeInTheDocument()
  })
})
