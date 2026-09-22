// @system — Tests for Dashboard FiltersBar component
import { render, screen, userEvent } from '../test-utils'
import { FiltersBar } from '@/app/components/@system/Dashboard/FiltersBar'

// Mock dependencies
jest.mock('@/app/components/@system/Button', () => ({
  Button: ({ children, onClick, ...props }) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}))

jest.mock('@/app/components/@system/Badge', () => ({
  Badge: ({ children, ...props }) => <span {...props}>{children}</span>,
}))

describe('FiltersBar', () => {
  it('renders search input when onSearchChange is provided', () => {
    render(<FiltersBar onSearchChange={jest.fn()} />)
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
  })

  it('does not render search input when onSearchChange is not provided', () => {
    render(<FiltersBar />)
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument()
  })

  it('calls onSearchChange when typing', async () => {
    const onSearchChange = jest.fn()
    const user = userEvent.setup()

    render(<FiltersBar onSearchChange={onSearchChange} searchValue="" />)
    await user.type(screen.getByPlaceholderText('Search...'), 'hello')

    expect(onSearchChange).toHaveBeenCalled()
  })

  it('renders filter toggle button when filters are provided', () => {
    const filters = [
      { id: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }] },
    ]

    render(<FiltersBar filters={filters} activeFilters={{}} />)
    expect(screen.getByText('Filters')).toBeInTheDocument()
  })

  it('shows active filter count badge', () => {
    const filters = [
      { id: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }] },
    ]

    render(<FiltersBar filters={filters} activeFilters={{ status: 'active' }} />)
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('shows clear all button when there are active filters', () => {
    const filters = [
      { id: 'status', label: 'Status', type: 'select', options: [] },
    ]

    render(
      <FiltersBar
        filters={filters}
        activeFilters={{ status: 'active' }}
        onSearchChange={jest.fn()}
        onClearAll={jest.fn()}
      />
    )
    expect(screen.getByText('Clear all')).toBeInTheDocument()
  })

  it('calls onClearAll when clear all is clicked', async () => {
    const onClearAll = jest.fn()
    const onSearchChange = jest.fn()
    const user = userEvent.setup()

    const filters = [
      { id: 'status', label: 'Status', type: 'select', options: [] },
    ]

    render(
      <FiltersBar
        filters={filters}
        activeFilters={{ status: 'active' }}
        onSearchChange={onSearchChange}
        onClearAll={onClearAll}
      />
    )

    await user.click(screen.getByText('Clear all'))
    expect(onClearAll).toHaveBeenCalledTimes(1)
    expect(onSearchChange).toHaveBeenCalledWith('')
  })

  it('shows custom search placeholder', () => {
    render(<FiltersBar onSearchChange={jest.fn()} searchPlaceholder="Find users..." />)
    expect(screen.getByPlaceholderText('Find users...')).toBeInTheDocument()
  })

  it('renders date range button when showDateRange is true', () => {
    render(<FiltersBar showDateRange />)
    expect(screen.getByText('Date range')).toBeInTheDocument()
  })
})
