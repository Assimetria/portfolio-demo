// @custom — BillingEditor undo/redo tests
// Tests for the billing line-item editor with undo/redo support
import { render, screen, waitFor } from '../test-utils'
import userEvent from '@testing-library/user-event'
import BillingEditor from '@/app/pages/@custom/PageEditor'
import * as billingApi from '@/app/api/@custom'

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/app/api/@custom', () => ({
  getBillingItems: jest.fn(),
  createBillingItem: jest.fn(),
  updateBillingItem: jest.fn(),
  deleteBillingItem: jest.fn(),
  undoBillingAction: jest.fn(),
  redoBillingAction: jest.fn(),
}))

// The Modal wraps radix Dialog — render children inline
jest.mock('@/app/components/@system/Modal', () => ({
  Modal: ({ open, title, description, children }) =>
    open ? (
      <div data-testid="editor-modal" role="dialog">
        {title && <h2>{title}</h2>}
        {description && <p>{description}</p>}
        {children}
      </div>
    ) : null,
}))

// Card components simplified
jest.mock('@/app/components/@system/Card', () => ({
  Card: ({ children, className }) => <div className={className}>{children}</div>,
  CardContent: ({ children, className }) => <div className={className}>{children}</div>,
  CardHeader: ({ children }) => <div>{children}</div>,
  CardTitle: ({ children }) => <h3>{children}</h3>,
  CardDescription: ({ children }) => <p>{children}</p>,
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

const sampleItems = [
  { id: 1, description: 'Web Development', amount: 5000, quantity: 1, total: 5000 },
  { id: 2, description: 'Hosting', amount: 100, quantity: 12, total: 1200 },
]

async function renderEditor(items = []) {
  billingApi.getBillingItems.mockResolvedValue({ items })
  billingApi.createBillingItem.mockResolvedValue({
    item: { id: 3, description: 'New Service', amount: 250, quantity: 1, total: 250 },
  })
  billingApi.updateBillingItem.mockResolvedValue({
    item: { id: 1, description: 'Web Development (Updated)', amount: 5500, quantity: 1, total: 5500 },
  })
  billingApi.deleteBillingItem.mockResolvedValue({ message: 'Item deleted', item: items[0] })
  billingApi.undoBillingAction.mockResolvedValue({ message: 'Undo successful', items })
  billingApi.redoBillingAction.mockResolvedValue({ message: 'Redo successful', items })

  const user = userEvent.setup()
  render(<BillingEditor />)
  await waitFor(() => expect(billingApi.getBillingItems).toHaveBeenCalled())

  return { user }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BillingEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading state initially', () => {
    billingApi.getBillingItems.mockReturnValue(new Promise(() => {}))
    render(<BillingEditor />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders empty state when no items', async () => {
    await renderEditor([])
    expect(screen.getByText(/no billing items yet/i)).toBeInTheDocument()
  })

  it('renders items in table', async () => {
    await renderEditor(sampleItems)
    expect(screen.getByText('Web Development')).toBeInTheDocument()
    expect(screen.getByText('Hosting')).toBeInTheDocument()
  })

  it('shows undo and redo buttons', async () => {
    await renderEditor(sampleItems)
    expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /redo/i })).toBeInTheDocument()
  })

  it('shows add item button', async () => {
    await renderEditor(sampleItems)
    expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument()
  })

  it('opens add modal on click', async () => {
    const { user } = await renderEditor([])
    await user.click(screen.getByRole('button', { name: /add item/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/add billing item/i)).toBeInTheDocument()
  })

  it('shows edit buttons for each item', async () => {
    await renderEditor(sampleItems)
    const editButtons = screen.getAllByRole('button', { name: /edit/i })
    expect(editButtons).toHaveLength(sampleItems.length)
  })

  it('shows delete buttons for each item', async () => {
    await renderEditor(sampleItems)
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    expect(deleteButtons).toHaveLength(sampleItems.length)
  })
})
