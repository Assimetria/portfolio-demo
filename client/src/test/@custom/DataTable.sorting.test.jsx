// @custom — Sorting behavior tests for DataTable component
// Tests focus on the sorting fix: null-safety, locale-aware comparison,
// ascending/descending toggling, and sort stability.
import { render, screen, userEvent, waitFor } from '../../test-utils'
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

describe('DataTable sorting', () => {
  const sortableColumns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'role', label: 'Role', sortable: true },
  ]

  // ── Ascending sort ───────────────────────────────────────────────────
  it('sorts data in ascending order when a column header is clicked', async () => {
    const user = userEvent.setup()
    const data = [
      { id: 1, name: 'Charlie', email: 'charlie@test.com', role: 'User' },
      { id: 2, name: 'Alice', email: 'alice@test.com', role: 'Admin' },
      { id: 3, name: 'Bob', email: 'bob@test.com', role: 'User' },
    ]

    render(<DataTable columns={sortableColumns} data={data} />)

    // Click the "Name" header to sort ascending
    await user.click(screen.getByText('Name'))

    // Grab all rendered name cells
    const rows = screen.getAllByRole('row')
    const nameCells = rows.slice(1).map((row) => row.children[0].textContent)

    expect(nameCells).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  // ── Descending sort ──────────────────────────────────────────────────
  it('sorts data in descending order when same column is clicked twice', async () => {
    const user = userEvent.setup()
    const data = [
      { id: 1, name: 'Charlie', email: 'charlie@test.com', role: 'User' },
      { id: 2, name: 'Alice', email: 'alice@test.com', role: 'Admin' },
      { id: 3, name: 'Bob', email: 'bob@test.com', role: 'User' },
    ]

    render(<DataTable columns={sortableColumns} data={data} />)

    await user.click(screen.getByText('Name'))
    await user.click(screen.getByText('Name'))

    const rows = screen.getAllByRole('row')
    const nameCells = rows.slice(1).map((row) => row.children[0].textContent)

    expect(nameCells).toEqual(['Charlie', 'Bob', 'Alice'])
  })

  // ── Toggle column sort ───────────────────────────────────────────────
  it('switches to ascending sort when a different column is clicked', async () => {
    const user = userEvent.setup()
    const data = [
      { id: 1, name: 'Charlie', email: 'charlie@test.com', role: 'User' },
      { id: 2, name: 'Alice', email: 'alice@test.com', role: 'Admin' },
      { id: 3, name: 'Bob', email: 'bob@test.com', role: 'User' },
    ]

    render(<DataTable columns={sortableColumns} data={data} />)

    // Sort by Name descending first
    await user.click(screen.getByText('Name'))
    await user.click(screen.getByText('Name'))

    // Then click Email — should sort ascending by Email
    await user.click(screen.getByText('Email'))

    const rows = screen.getAllByRole('row')
    const emailCells = rows.slice(1).map((row) => row.children[1].textContent)

    expect(emailCells).toEqual([
      'alice@test.com',
      'bob@test.com',
      'charlie@test.com',
    ])
  })

  // ── Null/undefined values ────────────────────────────────────────────
  it('handles null values by sorting them to the end', async () => {
    const user = userEvent.setup()
    const data = [
      { id: 1, name: 'Alice', email: 'alice@test.com', role: 'Admin' },
      { id: 2, name: null, email: 'bob@test.com', role: 'User' },
      { id: 3, name: 'Charlie', email: 'charlie@test.com', role: 'User' },
    ]

    render(<DataTable columns={sortableColumns} data={data} />)

    await user.click(screen.getByText('Name'))

    const rows = screen.getAllByRole('row')
    const nameCells = rows.slice(1).map((row) => row.children[0].textContent)

    expect(nameCells[2]).toBe('')
    expect(nameCells[0]).toBe('Alice')
    expect(nameCells[1]).toBe('Charlie')
  })

  // ── Case-insensitive sorting ─────────────────────────────────────────
  it('sorts case-insensitively', async () => {
    const user = userEvent.setup()
    const data = [
      { id: 1, name: 'alice', email: 'alice@test.com', role: 'User' },
      { id: 2, name: 'Bob', email: 'bob@test.com', role: 'User' },
      { id: 3, name: 'Charlie', email: 'charlie@test.com', role: 'Admin' },
    ]

    render(<DataTable columns={sortableColumns} data={data} />)

    await user.click(screen.getByText('Name'))

    const rows = screen.getAllByRole('row')
    const nameCells = rows.slice(1).map((row) => row.children[0].textContent)

    expect(nameCells[0].toLowerCase()).toBe('alice')
    expect(nameCells[1].toLowerCase()).toBe('bob')
    expect(nameCells[2].toLowerCase()).toBe('charlie')
  })

  // ── Numeric sorting ──────────────────────────────────────────────────
  it('sorts numeric values correctly (not lexicographically)', async () => {
    const columnsWithNumeric = [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'score', label: 'Score', sortable: true },
    ]
    const user = userEvent.setup()
    const data = [
      { id: 1, name: 'Alice', score: 100 },
      { id: 2, name: 'Bob', score: 20 },
      { id: 3, name: 'Charlie', score: 5 },
      { id: 4, name: 'Diana', score: 1000 },
    ]

    render(<DataTable columns={columnsWithNumeric} data={data} />)

    await user.click(screen.getByText('Score'))

    const rows = screen.getAllByRole('row')
    const scoreCells = rows.slice(1).map((row) => Number(row.children[1].textContent))

    expect(scoreCells).toEqual([5, 20, 100, 1000])
  })

  // ── Stable sort ──────────────────────────────────────────────────────
  it('preserves original order for items with equal sort values', async () => {
    const user = userEvent.setup()
    const data = [
      { id: 1, name: 'Alice', email: 'a@test.com', role: 'Admin' },
      { id: 2, name: 'Bob', email: 'b@test.com', role: 'User' },
      { id: 3, name: 'Charlie', email: 'c@test.com', role: 'User' },
      { id: 4, name: 'Diana', email: 'd@test.com', role: 'Admin' },
    ]

    render(<DataTable columns={sortableColumns} data={data} />)

    await user.click(screen.getByText('Role'))

    const rows = screen.getAllByRole('row')
    const idCells = rows.slice(1).map((row) => Number(row.children[3].textContent))

    expect(idCells[0]).toBe(1)
    expect(idCells[1]).toBe(4)
    expect(idCells[2]).toBe(2)
    expect(idCells[3]).toBe(3)
  })
})