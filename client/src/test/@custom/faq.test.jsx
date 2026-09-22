// @custom — FAQ Page tests
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FAQPage from '@/app/pages/static/@custom/FAQPage'
import { FAQ_ITEMS, FAQ_CATEGORIES, filterByCategory, searchFAQ } from '@/app/pages/static/@custom/FAQPage/data'

// Mock @/config
vi.mock('@/config', () => ({
  info: {
    name: 'Test Product',
    supportEmail: 'support@test.com',
    defaultTheme: 'light',
  },
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Search: () => <div data-testid="mock-search-icon" />,
  FolderOpen: () => <div data-testid="mock-folder-icon" />,
  ChevronDown: () => <div data-testid="mock-chevron-icon" />,
}))

// Mock @radix-ui/react-accordion
vi.mock('@radix-ui/react-accordion', () => ({
  default: {},
  Root: ({ children, ...props }) => <div data-testid="accordion-root" {...props}>{children}</div>,
  Item: ({ children, ...props }) => <div data-testid="accordion-item" {...props}>{children}</div>,
  Trigger: ({ children, ...props }) => <button data-testid="accordion-trigger" {...props}>{children}</button>,
  Content: ({ children, ...props }) => <div data-testid="accordion-content" {...props}>{children}</div>,
  Header: ({ children }) => <div data-testid="accordion-header">{children}</div>,
}))

describe('FAQPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the FAQ page with title', () => {
    render(<FAQPage />)
    expect(screen.getByText('Localization FAQ')).toBeInTheDocument()
  })

  it('renders ALL FAQ items by default', () => {
    render(<FAQPage />)
    // Check that the first FAQ question is visible
    expect(screen.getByText(FAQ_ITEMS[0].question)).toBeInTheDocument()
    // Check that the last FAQ question is also visible
    expect(screen.getByText(FAQ_ITEMS[FAQ_ITEMS.length - 1].question)).toBeInTheDocument()
  })

  it('shows search input', () => {
    render(<FAQPage />)
    expect(screen.getByPlaceholderText('Search FAQ…')).toBeInTheDocument()
  })

  it('filters items when searching', () => {
    render(<FAQPage />)
    const searchInput = screen.getByPlaceholderText('Search FAQ…')
    fireEvent.change(searchInput, { target: { value: 'encoding' } })
    // The item about character encoding should still be visible
    expect(screen.getByText('What is the most common cause of character encoding issues?')).toBeInTheDocument()
  })

  it('shows empty state when no results match', () => {
    render(<FAQPage />)
    const searchInput = screen.getByPlaceholderText('Search FAQ…')
    fireEvent.change(searchInput, { target: { value: 'zzzznonexistent' } })
    expect(screen.getByText('No FAQ items match your search')).toBeInTheDocument()
  })
})

describe('FAQ data helpers', () => {
  it('filterByCategory returns all items when category is null', () => {
    expect(filterByCategory(FAQ_ITEMS, null)).toHaveLength(FAQ_ITEMS.length)
  })

  it('filterByCategory returns items matching category', () => {
    const result = filterByCategory(FAQ_ITEMS, 'Character Encoding')
    expect(result).toHaveLength(1)
    expect(result[0].category).toBe('Character Encoding')
  })

  it('searchFAQ finds items by question text', () => {
    const result = searchFAQ(FAQ_ITEMS, 'date')
    expect(result.length).toBeGreaterThan(0)
    expect(result.some((i) => i.id === 'faq-2')).toBe(true)
  })

  it('searchFAQ finds items by tag', () => {
    const result = searchFAQ(FAQ_ITEMS, 'rtl')
    expect(result.length).toBeGreaterThan(0)
    expect(result.some((i) => i.id === 'faq-5')).toBe(true)
  })

  it('searchFAQ returns all items for empty query', () => {
    expect(searchFAQ(FAQ_ITEMS, '')).toHaveLength(FAQ_ITEMS.length)
    expect(searchFAQ(FAQ_ITEMS, '   ')).toHaveLength(FAQ_ITEMS.length)
  })

  it('searchFAQ returns empty array for non-matching query', () => {
    expect(searchFAQ(FAQ_ITEMS, 'xyznonexistent')).toHaveLength(0)
  })

  it('FAQ_CATEGORIES has the expected categories', () => {
    expect(FAQ_CATEGORIES).toContain('Character Encoding')
    expect(FAQ_CATEGORIES).toContain('Date & Time')
    expect(FAQ_CATEGORIES).toContain('RTL Support')
    expect(FAQ_CATEGORIES).toContain('Pluralization')
    expect(FAQ_CATEGORIES.length).toBeGreaterThanOrEqual(10)
  })
})