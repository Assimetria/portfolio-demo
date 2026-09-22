// @system — Tests for Dashboard DataTable component
import { render, screen, userEvent, waitFor } from '../test-utils'
import { DataTable } from '@/app/components/@system/Dashboard/DataTable'

// Mock dependencies
jest.mock('@/app/components/@system/Table', () => {
  const Table = ({ children }) => <table>{children}</table>
  Table.Header = ({ children }) => <thead>{children}</thead>
  Table.Body = ({ children }) => <tbody>{children}</tbody>
  Table.Row = ({ children, onClick, ...props }) => <tr onClick={onClick} {...props}>{children}</tr>
  Table.Head = ({ children, onClick, ...props }) => <th onClick={onClick} {...props}>{children}</th>
  Table.Cell = ({ children, ...props }) => <td {...props}>{children}</td>
  return { Table }
})

jest.mock('@/app/components/@system/Button', () => ({
  Button: ({ children, onClick, disabled, ...props }) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}))

jest.mock('@/app/components/@system/Select', () => ({
  Select: ({ value, onValueChange, options }) => (
    <select data-testid="page-size-select" value={value} onChange={e => onValueChange(e.target.value)}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}))

jest.mock('@/app/components/@system/EmptyState', () => ({
  EmptyState: ({ title, description }) => <div data-testid="empty-state">{title} - {description}</div>,
}))

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role' },
]

const data = [
  { id: 1, name: 'Alice', email: 'alice@test.com', role: 'Admin' },
  { id: 2, name: 'Bob', email: 'bob@test.com', role: 'User' },
  { id: 3, name: 'Charlie', email: 'charlie@test.com', role: 'User' },
]

describe('DataTable', () => {
  it('renders column headers', () => {
    render(<DataTable columns={columns} data={data} />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Role')).toBeInTheDocument()
  })

  it('renders all data rows', () => {
    render(<DataTable columns={columns} data={data} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Charlie')).toBeInTheDocument()
  })

  it('shows empty state when no data', () => {
    render(<DataTable columns={columns} data={[]} />)
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
  })

  it('renders search input when searchable', () => {
    render(<DataTable columns={columns} data={data} searchable />)
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
  })

  it('filters data when searching', async () => {
    const user = userEvent.setup()
    render(<DataTable columns={columns} data={data} searchable />)

    await user.type(screen.getByPlaceholderText('Search...'), 'Alice')

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.queryByText('Bob')).not.toBeInTheDocument()
    expect(screen.queryByText('Charlie')).not.toBeInTheDocument()
  })

  it('shows "No results found" when search matches nothing', async () => {
    const user = userEvent.setup()
    render(<DataTable columns={columns} data={data} searchable />)

    await user.type(screen.getByPlaceholderText('Search...'), 'nonexistent')

    expect(screen.getByTestId('empty-state')).toHaveTextContent('No results found')
  })

  it('renders custom cell content via render function', () => {
    const customColumns = [
      ...columns.slice(0, 2),
      { key: 'role', label: 'Role', render: (value) => <span data-testid="role-badge">{value}</span> },
    ]

    render(<DataTable columns={customColumns} data={data} />)
    const badges = screen.getAllByTestId('role-badge')
    expect(badges).toHaveLength(3)
  })

  it('calls onRowClick when a row is clicked', async () => {
    const onRowClick = jest.fn()
    const user = userEvent.setup()

    render(<DataTable columns={columns} data={data} onRowClick={onRowClick} />)
    await user.click(screen.getByText('Alice'))

    expect(onRowClick).toHaveBeenCalledWith(data[0])
  })
})
