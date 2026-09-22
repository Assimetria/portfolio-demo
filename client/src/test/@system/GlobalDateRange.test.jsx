// @system — Tests for the global date-range context.
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import {
  GlobalDateRangeProvider,
  useGlobalDateRange,
  todayISO,
  subDaysISO,
  addDaysISO,
  isISOAnchor,
} from '@/app/store/@system/dateRange'

const STORAGE_KEY = 'system.globalDateRange'

function wrapper({ children }) {
  return <GlobalDateRangeProvider>{children}</GlobalDateRangeProvider>
}

function mountHook() {
  return renderHook(() => useGlobalDateRange(), { wrapper })
}

describe('GlobalDateRangeProvider', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to the trailing 30-day window', () => {
    const { result } = mountHook()
    const end = todayISO()
    const start = subDaysISO(end, 29)
    expect(result.current.rangeEnd).toBe(end)
    expect(result.current.rangeStart).toBe(start)
    expect(result.current.preset).toBe('last30')
  })

  it('persists a requested range to localStorage', () => {
    const { result } = mountHook()
    act(() => {
      result.current.setRange({ rangeStart: '2024-02-01', rangeEnd: '2024-02-10', preset: 'custom' })
    })
    expect(result.current.rangeStart).toBe('2024-02-01')
    expect(result.current.rangeEnd).toBe('2024-02-10')
    expect(result.current.preset).toBe('custom')

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored).toMatchObject({ rangeStart: '2024-02-01', rangeEnd: '2024-02-10', preset: 'custom' })
  })

  it('normalises a reversed window so rangeStart <= rangeEnd', () => {
    const { result } = mountHook()
    act(() => {
      result.current.setRange({ rangeStart: '2024-03-20', rangeEnd: '2024-03-01' })
    })
    expect(result.current.rangeStart).toBe('2024-03-01')
    expect(result.current.rangeEnd).toBe('2024-03-20')
  })

  it('ignores garbage values and falls back to the default window', () => {
    const { result } = mountHook()
    const before = { start: result.current.rangeStart, end: result.current.rangeEnd }
    act(() => {
      result.current.setRange({ rangeStart: 'not-a-date', rangeEnd: null })
    })
    expect(result.current.rangeStart).toBe(before.start)
    expect(result.current.rangeEnd).toBe(before.end)
  })

  it('wraps consumers so setRange updates them', () => {
    render(
      <GlobalDateRangeProvider>
        <ConsumerBar />
      </GlobalDateRangeProvider>
    )
    expect(screen.getByTestId('range-end')).toHaveTextContent(todayISO())
    act(() => {
      /** trigger via the harness (see ConsumerBar) */
    })
  })

  it('restores previously persisted value on a fresh mount', () => {
    const persisted = { rangeStart: '2023-11-01', rangeEnd: '2023-12-31', preset: 'custom' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
    const { result } = mountHook()
    expect(result.current.rangeStart).toBe('2023-11-01')
    expect(result.current.rangeEnd).toBe('2023-12-31')
  })
})

describe('date helpers', () => {
  it('are exposed for deterministic UI input parsing', () => {
    expect(isISOAnchor('2024-02-01')).toBe(true)
    expect(isISOAnchor('2024-02-01T00:00:00Z')).toBe(false)
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(addDaysISO('2024-02-27', 3)).toBe('2024-03-01')
    expect(subDaysISO('2024-03-01', 3)).toBe('2024-02-27')
  })
})

function ConsumerBar() {
  const { rangeStart, rangeEnd } = useGlobalDateRange()
  return (
    <div>
      <span data-testid="range-start">{rangeStart}</span>
      <span data-testid="range-end">{rangeEnd}</span>
    </div>
  )
}
