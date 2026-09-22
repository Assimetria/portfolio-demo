// @custom — Root ThemeContext/ThemeProvider tests.
// These exercise the provider contract at its point of definition so products that
// specialise this file (without touching the @system theme bridge) keep the same
// guarantees: { theme, resolvedTheme, setTheme }, localStorage['app-theme']
// persistence, matchMedia-based system resolution, and .dark class toggling.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  ThemeProvider,
  ThemeContext,
  useThemeContext,
  VALID_THEMES,
  getSystemTheme,
} from '@/app/store/@custom/ThemeContext'

vi.mock('@/config', () => ({ info: { defaultTheme: 'light' } }))

let mediaListeners = []
const mockMatchMedia = vi.fn((query) => ({
  matches: false,
  media: query,
  addEventListener: (_, cb) => { mediaListeners.push(cb) },
  removeEventListener: (_, cb) => { mediaListeners = mediaListeners.filter((l) => l !== cb) },
  addListener: vi.fn(),
  removeListener: vi.fn(),
  onchange: null,
  dispatchEvent: vi.fn(),
}))

function wrapper({ children }) {
  return <ThemeProvider>{children}</ThemeProvider>
}

beforeEach(() => {
  localStorage.clear()
  mediaListeners = []
  document.documentElement.classList.remove('dark')
  window.matchMedia = mockMatchMedia
})

describe('@custom ThemeContext contract', () => {
  it('exposes the right shape and valid theme choices', () => {
    expect(ThemeContext).toBeTruthy()
    expect(VALID_THEMES).toEqual(['light', 'dark', 'system'])
    expect(ThemeProvider).toBeTruthy()
  })

  it('provides { theme, resolvedTheme, setTheme } to consumers', () => {
    const { result } = renderHook(() => useThemeContext(), { wrapper })
    expect(result.current).toMatchObject({
      theme: 'light',
      resolvedTheme: 'light',
    })
    expect(typeof result.current.setTheme).toBe('function')
  })

  it('resolves system to the OS colour scheme', () => {
    // window prefers dark
    mockMatchMedia.mockReturnValue({ matches: true })
    expect(getSystemTheme()).toBe('dark')

    // restoring light preference for the provider default path
    mockMatchMedia.mockReturnValue({ matches: false })
    const { result } = renderHook(() => useThemeContext(), { wrapper })
    act(() => { result.current.setTheme('system') })
    expect(result.current.theme).toBe('system')
    expect(result.current.resolvedTheme).toBe('light')
  })

  it('persists setTheme to localStorage and rejects invalid themes', () => {
    const { result } = renderHook(() => useThemeContext(), { wrapper })

    act(() => { result.current.setTheme('dark') })
    expect(result.current.theme).toBe('dark')
    expect(localStorage.getItem('app-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    act(() => { result.current.setTheme('sepia') })
    expect(result.current.theme).toBe('dark') // unchanged — invalid ignored
    expect(localStorage.getItem('app-theme')).toBe('dark')
  })

  it('throws outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useThemeContext())).toThrow(
      'UseThemeContext must be used inside <ThemeProvider>',
    )
    spy.mockRestore()
  })
})
