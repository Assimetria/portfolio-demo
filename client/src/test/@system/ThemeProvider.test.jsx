// @system — ThemeProvider + useTheme tests
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderHook } from '@testing-library/react'
import { ThemeProvider, useTheme } from '@/app/store/@system/theme'

// Mock @/config so getInitialTheme() works without real config
vi.mock('@/config', () => ({ info: { defaultTheme: 'light' } }))

// Track matchMedia listeners
let mediaListeners = []
const mockMatchMedia = vi.fn((query) => ({
  matches: false,
  media: query,
  addEventListener: (_, cb) => { mediaListeners.push(cb) },
  removeEventListener: (_, cb) => { mediaListeners = mediaListeners.filter(l => l !== cb) },
  addListener: vi.fn(),
  removeListener: vi.fn(),
  onchange: null,
  dispatchEvent: vi.fn(),
}))

beforeEach(() => {
  localStorage.clear()
  mediaListeners = []
  document.documentElement.classList.remove('dark')
  window.matchMedia = mockMatchMedia
})

function wrapper({ children }) {
  return <ThemeProvider>{children}</ThemeProvider>
}

describe('ThemeProvider', () => {
  it('renders children', () => {
    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>
    )
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('defaults to light theme', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.theme).toBe('light')
    expect(result.current.resolvedTheme).toBe('light')
  })

  it('persists theme to localStorage', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => { result.current.setTheme('dark') })

    expect(localStorage.getItem('app-theme')).toBe('dark')
    expect(result.current.theme).toBe('dark')
    expect(result.current.resolvedTheme).toBe('dark')
  })

  it('restores theme from localStorage', () => {
    localStorage.setItem('app-theme', 'dark')

    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.theme).toBe('dark')
  })

  it('applies dark class to documentElement', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => { result.current.setTheme('dark') })
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    act(() => { result.current.setTheme('light') })
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('ignores invalid theme values', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => { result.current.setTheme('neon') })
    expect(result.current.theme).toBe('light') // unchanged
  })

  it('accepts system theme value', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => { result.current.setTheme('system') })
    expect(result.current.theme).toBe('system')
    // resolvedTheme should be light since matchMedia.matches = false
    expect(result.current.resolvedTheme).toBe('light')
  })
})

describe('useTheme', () => {
  it('throws when used outside ThemeProvider', () => {
    // Suppress console.error for expected error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      renderHook(() => useTheme())
    }).toThrow('useTheme must be used inside <ThemeProvider>')

    spy.mockRestore()
  })
})
