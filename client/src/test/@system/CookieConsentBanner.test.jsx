// @system — CookieConsentBanner + useCookieConsent tests
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { renderHook } from '@testing-library/react'
import { CookieConsentBanner, useCookieConsent } from '@system/CookieConsentBanner'

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

function renderBanner(props = {}) {
  return render(
    <MemoryRouter>
      <CookieConsentBanner {...props} />
    </MemoryRouter>
  )
}

describe('CookieConsentBanner', () => {
  it('shows banner after delay when no consent stored', async () => {
    renderBanner()

    // Banner not visible immediately (600ms delay)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Advance past the 600ms delay
    act(() => { vi.advanceTimersByTime(700) })

    expect(screen.getByRole('dialog', { name: /cookie consent/i })).toBeInTheDocument()
    expect(screen.getByText(/we use cookies/i)).toBeInTheDocument()
  })

  it('does not show banner when consent already stored', () => {
    localStorage.setItem('cookie_consent', JSON.stringify({ value: 'all', ts: Date.now() }))

    renderBanner()
    act(() => { vi.advanceTimersByTime(700) })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('hides after clicking Accept all and saves consent', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderBanner()
    act(() => { vi.advanceTimersByTime(700) })

    await user.click(screen.getByRole('button', { name: /accept all/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const stored = JSON.parse(localStorage.getItem('cookie_consent'))
    expect(stored.value).toBe('all')
  })

  it('hides after clicking Essential only and saves consent', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderBanner()
    act(() => { vi.advanceTimersByTime(700) })

    await user.click(screen.getByRole('button', { name: /essential only/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const stored = JSON.parse(localStorage.getItem('cookie_consent'))
    expect(stored.value).toBe('essential')
  })

  it('contains a link to the cookie policy', () => {
    renderBanner()
    act(() => { vi.advanceTimersByTime(700) })

    const link = screen.getByRole('link', { name: /cookie policy/i })
    expect(link).toHaveAttribute('href', '/cookies')
  })

  it('clears expired consent and shows banner again', () => {
    // Store consent with expired timestamp (> 1 year ago)
    const expired = Date.now() - (366 * 24 * 60 * 60 * 1000)
    localStorage.setItem('cookie_consent', JSON.stringify({ value: 'all', ts: expired }))

    renderBanner()
    act(() => { vi.advanceTimersByTime(700) })

    expect(screen.getByRole('dialog', { name: /cookie consent/i })).toBeInTheDocument()
  })
})

describe('useCookieConsent', () => {
  it('returns null when no consent stored', () => {
    const { result } = renderHook(() => useCookieConsent())
    expect(result.current.consent).toBeNull()
  })

  it('returns stored consent value', () => {
    localStorage.setItem('cookie_consent', JSON.stringify({ value: 'essential', ts: Date.now() }))

    const { result } = renderHook(() => useCookieConsent())
    expect(result.current.consent).toBe('essential')
  })
})
