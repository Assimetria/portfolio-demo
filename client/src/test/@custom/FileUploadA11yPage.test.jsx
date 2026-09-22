/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FileUploadA11yPage } from '../../src/app/pages/static/@custom/FileUploadA11yPage'
import { A11Y_STANDARDS, A11Y_CATEGORIES, filterByCategory, searchStandards } from '../../src/app/pages/static/@custom/FileUploadA11yPage/data'

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('../../src/config', () => ({
  info: {
    brandName: 'Test Brand',
  },
}))

jest.mock('../../src/app/components/@system/Header', () => ({
  Header: () => <div data-testid="mock-header">Header</div>,
}))

// ── Data tests ─────────────────────────────────────────────────────────────

describe('A11Y_STANDARDS data', () => {
  it('exports an array of standards', () => {
    expect(Array.isArray(A11Y_STANDARDS)).toBe(true)
    expect(A11Y_STANDARDS.length).toBeGreaterThan(0)
  })

  it('each standard has required fields', () => {
    for (const s of A11Y_STANDARDS) {
      expect(s).toHaveProperty('id')
      expect(s).toHaveProperty('title')
      expect(s).toHaveProperty('summary')
      expect(s).toHaveProperty('criteria')
      expect(s).toHaveProperty('tags')
      expect(typeof s.title).toBe('string')
      expect(typeof s.summary).toBe('string')
      expect(typeof s.criteria).toBe('string')
      expect(Array.isArray(s.tags)).toBe(true)
    }
  })

  it('covers various accessibility topics', () => {
    const titles = A11Y_STANDARDS.map((s) => s.title)
    expect(titles).toContain('Keyboard Operability (WCAG 2.1.1)')
    expect(titles).toContain('Focus Management (WCAG 2.4.3)')
    expect(titles).toContain('Drag-and-Drop Accessibility (WCAG 2.5.1 / 2.5.7)')
    expect(titles).toContain('Touch Target Size (WCAG 2.5.5 / 2.5.8)')
  })
})

describe('A11Y_CATEGORIES', () => {
  it('exports array of category names', () => {
    expect(Array.isArray(A11Y_CATEGORIES)).toBe(true)
    expect(A11Y_CATEGORIES.length).toBeGreaterThan(0)
    expect(A11Y_CATEGORIES).toContain('Keyboard & Focus')
    expect(A11Y_CATEGORIES).toContain('Mobile & Touch')
  })
})

describe('filterByCategory', () => {
  it('returns all items when category is null', () => {
    expect(filterByCategory(A11Y_STANDARDS, null)).toHaveLength(A11Y_STANDARDS.length)
  })

  it('filters items by Keyboard & Focus category', () => {
    const filtered = filterByCategory(A11Y_STANDARDS, 'Keyboard & Focus')
    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.every((i) => i.tags.some((t) => ['keyboard', 'focus', 'focus-order', 'WCAG 2.1.1', 'WCAG 2.4.3'].includes(t)))).toBe(true)
  })

  it('returns empty array when no items match', () => {
    const filtered = filterByCategory(A11Y_STANDARDS, 'NonExistent')
    expect(filtered).toHaveLength(0)
  })
})

describe('searchStandards', () => {
  it('returns all items when query is empty', () => {
    expect(searchStandards(A11Y_STANDARDS, '')).toHaveLength(A11Y_STANDARDS.length)
  })

  it('filters by title keyword', () => {
    const filtered = searchStandards(A11Y_STANDARDS, 'Keyboard')
    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.every((i) => i.title.toLowerCase().includes('keyboard'))).toBe(true)
  })

  it('filters by tag keyword', () => {
    const filtered = searchStandards(A11Y_STANDARDS, 'mobile')
    expect(filtered.length).toBeGreaterThan(0)
  })

  it('returns empty array for non-matching query', () => {
// ── Page rendering tests ───────────────────────────────────────────────────

describe('FileUploadA11yPage', () => {
  it('renders the page title', () => {
    render(<FileUploadA11yPage />)
    expect(screen.getByText('File-Upload Accessibility Standards')).toBeInTheDocument()
  })

  it('renders the search input', () => {
    render(<FileUploadA11yPage />)
    expect(screen.getByPlaceholderText('Search accessibility standards\u2026')).toBeInTheDocument()
  })

  it('renders the Header component', () => {
    render(<FileUploadA11yPage />)
    expect(screen.getByTestId('mock-header')).toBeInTheDocument()
  })

  it('renders the category filter buttons', () => {
    render(<FileUploadA11yPage />)
    A11Y_CATEGORIES.forEach((cat) => {
      expect(screen.getByText(cat)).toBeInTheDocument()
    })
    expect(screen.getByText('All')).toBeInTheDocument()
  })

  it('shows the count of displayed standards', () => {
    render(<FileUploadA11yPage />)
    expect(screen.getByText(new RegExp(`Showing ${A11Y_STANDARDS.length} of ${A11Y_STANDARDS.length}`))).toBeInTheDocument()
  })

  it('renders accordion triggers for each standard', () => {
    render(<FileUploadA11yPage />)
    A11Y_STANDARDS.forEach((s) => {
      expect(screen.getByText(s.title)).toBeInTheDocument()
    })
  })

  it('renders standard summaries', () => {
    render(<FileUploadA11yPage />)
    A11Y_STANDARDS.forEach((s) => {
      expect(screen.getByText(s.summary)).toBeInTheDocument()
    })
  })

  it('filters standards when typing in search', async () => {
    const user = userEvent.setup()
    render(<FileUploadA11yPage />)
    const searchInput = screen.getByPlaceholderText('Search accessibility standards\u2026')
    await user.type(searchInput, 'Keyboard')
    expect(screen.getByText('Keyboard Operability (WCAG 2.1.1)')).toBeInTheDocument()
    expect(screen.queryByText('Touch Target Size (WCAG 2.5.5 / 2.5.8)')).not.toBeInTheDocument()
  })

  it('filters standards when clicking a category', async () => {
    const user = userEvent.setup()
    render(<FileUploadA11yPage />)
    const mobileBtn = screen.getByText('Mobile & Touch')
    await user.click(mobileBtn)
    expect(screen.getByText('Touch Target Size (WCAG 2.5.5 / 2.5.8)')).toBeInTheDocument()
  })

  it('shows empty state when no results match search', async () => {
    const user = userEvent.setup()
    render(<FileUploadA11yPage />)
    const searchInput = screen.getByPlaceholderText('Search accessibility standards\u2026')
    await user.type(searchInput, 'zzznotexist')
    expect(screen.getByText('No accessibility standards match your search.')).toBeInTheDocument()
  })

  it('clears category filter when clicking All', async () => {
    const user = userEvent.setup()
    render(<FileUploadA11yPage />)
    const mobileBtn = screen.getByText('Mobile & Touch')
    await user.click(mobileBtn)
    const allBtn = screen.getByText('All')
    await user.click(allBtn)
    expect(screen.getByText(new RegExp(`Showing ${A11Y_STANDARDS.length}`))).toBeInTheDocument()
  })
})
    const filtered = searchStandards(A11Y_STANDARDS, 'zzznotexist')
    expect(filtered).toHaveLength(0)
  })
})