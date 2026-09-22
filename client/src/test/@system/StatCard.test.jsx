// @system — Tests for Dashboard StatCard component
import { render, screen, userEvent } from '../test-utils'
import { StatCard, StatCardGrid } from '@/app/components/@system/Dashboard/StatCard'

// Mock Card components
jest.mock('@/app/components/@system/Card', () => ({
  Card: ({ children, className, ...props }) => <div data-testid="card" className={className} {...props}>{children}</div>,
  CardHeader: ({ children, ...props }) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }) => <p {...props}>{children}</p>,
}))

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Total Users" value="1,234" />)
    expect(screen.getByText('Total Users')).toBeInTheDocument()
    expect(screen.getByText('1,234')).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(<StatCard label="Revenue" value="$5K" description="vs last month" />)
    expect(screen.getByText('vs last month')).toBeInTheDocument()
  })

  it('renders up trend indicator', () => {
    render(<StatCard label="Users" value="100" trend={{ value: 12, direction: 'up' }} />)
    expect(screen.getByText('12%')).toBeInTheDocument()
  })

  it('renders down trend indicator', () => {
    render(<StatCard label="Churn" value="5%" trend={{ value: 3, direction: 'down' }} />)
    expect(screen.getByText('3%')).toBeInTheDocument()
  })

  it('renders action button when provided', async () => {
    const onClick = jest.fn()
    const user = userEvent.setup()

    render(<StatCard label="Users" value="100" action={{ label: 'View all', onClick }} />)
    const actionBtn = screen.getByText('View all')
    expect(actionBtn).toBeInTheDocument()

    await user.click(actionBtn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders loading skeleton when loading=true', () => {
    render(<StatCard label="Users" value="100" loading />)
    expect(screen.queryByText('Users')).not.toBeInTheDocument()
    expect(screen.queryByText('100')).not.toBeInTheDocument()
    // Card should have animate-pulse class
    expect(screen.getByTestId('card')).toHaveClass('animate-pulse')
  })

  it('renders icon when provided', () => {
    const MockIcon = (props) => <svg data-testid="icon" {...props} />
    render(<StatCard label="Users" value="100" icon={MockIcon} />)
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })
})

describe('StatCardGrid', () => {
  it('renders children in a grid', () => {
    render(
      <StatCardGrid>
        <div data-testid="child-1">Card 1</div>
        <div data-testid="child-2">Card 2</div>
      </StatCardGrid>
    )
    expect(screen.getByTestId('child-1')).toBeInTheDocument()
    expect(screen.getByTestId('child-2')).toBeInTheDocument()
  })
})
