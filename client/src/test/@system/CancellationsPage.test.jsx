// @system — CancellationsPage report tests
//
// Mounting reads the *global* date-range window (see store/@system/dateRange)
// and always forwards explicit YYYY-MM-DD bounds to listCancellations so the
// server does the real filtering. These tests confirm that wiring: render with
// the provider, refetch after the page's own controls change the window, and
// surface loading/error/empty states.
import { render, screen, waitFor } from '../test-utils'
import { fireEvent } from '@testing-library/react'
import { GlobalDateRangeProvider, todayISO, subDaysISO } from '@/app/store/@system/dateRange'
import { CancellationsPage } from '@/app/pages/app/@system/AdminPage/CancellationsPage'

// Stub only the network call; the page + date-range context stay real so we can
// assert that changing the global window triggers a fresh (bounded) request.
jest.mock('@/app/api/@system/admin', () => ({
  listCancellations: jest.fn(),
}))

const { listCancellations } = require('@/app/api/@system/admin')

const okPayload = {
  data: {
    total: 12,
    reasons: [
      { cancellation_type: 'price', cancellation_reason: 'too_expensive', count: 8 },
      { cancellation_type: 'feature', cancellation_reason: 'missing_billing', count: 4 },
    ],
  },
}

function renderPage() {
  return render(
    <GlobalDateRangeProvider>
      <CancellationsPage />
    </GlobalDateRangeProvider>
  )
}

describe('CancellationsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    jest.clearAllMocks()
  })

  it('loads the trailing global window on mount and renders KPIs + breakdown', async () => {
    listCancellations.mockResolvedValue(okPayload)

    renderPage()

    const today = todayISO()
    expect(await screen.findByText('66%')).toBeInTheDocument()

    // Initial request always reflects the provider default (last 30 dates).
    const initialCall = listCancellations.mock.calls[0][0]
    expect(initialCall.period).toBe('month')
    expect(initialCall.endDate).toBe(today)
    expect(initialCall.startDate).toBe(subDaysISO(today, 29))

    // KPI total
    expect(screen.getByText('12')).toBeInTheDocument()

    // Breakdown rows (8 + 4 = 12)
    const rows = screen.getAllByTestId('reason-row')
    expect(rows).toHaveLength(2)
    expect(screen.getByText('too_expensive')).toBeInTheDocument()
    expect(screen.getByText('price')).toBeInTheDocument()
    expect(screen.getByText('33%')).toBeInTheDocument()
  })

  it('re-fetches with server-side bounds after an applied custom range', async () => {
    listCancellations.mockResolvedValue(okPayload)

    renderPage()

    // Wait for the initial request render to finish before changing the window.
    await screen.findByText('66%')
    expect(listCancellations).toHaveBeenCalledTimes(1)

    // Type an explicit window into the custom date inputs and Apply it.
    fireEvent.change(screen.getByTestId('range-start'), { target: { value: '2024-02-10' } })
    fireEvent.change(screen.getByTestId('range-end'), { target: { value: '2024-02-16' } })
    fireEvent.click(screen.getByTestId('apply-range'))

    await waitFor(() => expect(listCancellations).toHaveBeenCalledTimes(2))

    // The second request must carry the *explicit* bounds (period stays a
    // harmless default), proving filtering is not only a client-side concern.
    expect(listCancellations.mock.calls[1][0]).toEqual({
      period: 'month',
      startDate: '2024-02-10',
      endDate: '2024-02-16',
    })
  })

  it('propagates a shared preset update back through the API request', async () => {
    listCancellations.mockResolvedValue(okPayload)

    renderPage()

    await screen.findByText('66%')
    expect(listCancellations).toHaveBeenCalledTimes(1)

    fireEvent.change(screen.getByTestId('range-preset'), { target: { value: 'last7' } })

    await waitFor(() => expect(listCancellations).toHaveBeenCalledTimes(2))

    const presetParams = listCancellations.mock.calls[1][0]
    const today = todayISO()
    expect(presetParams).toEqual({
      period: 'month',
      startDate: subDaysISO(today, 6),
      endDate: today,
    })
  })

  it('shows an accessible error when the server rejects the request', async () => {
    listCancellations.mockResolvedValue({ status: 500, message: 'boom: query dead' })

    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('boom: query dead')
    expect(screen.queryByTestId('cancellations-table')).not.toBeInTheDocument()
  })

  it('shows the empty state when no cancellations match the window', async () => {
    listCancellations.mockResolvedValue({ data: { total: 0, reasons: [] } })

    renderPage()

    const empty = await screen.findByTestId('empty-state')
    expect(empty).toHaveTextContent('No cancellations recorded in this window.')
    expect(screen.queryByTestId('reason-row')).not.toBeInTheDocument()
  })
})
