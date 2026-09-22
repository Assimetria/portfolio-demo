// @custom — ThemeContext server-sync tests
// Verifies that the ThemeProvider attempts to restore and persist theme
// preferences via the server API (best-effort, silent on failure).
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  ThemeProvider,
  ThemeContext,
  useThemeContext,
  VALID_THEMES,
} from '@/app/store/@custom/ThemeContext'

vi.mock('@/config', () => ({ info: { defaultTheme: 'light' } }))

// Mock the API client
const mockApi = {
  get: vi.fn(),
  patch: vi.fn(),
}
vi.mock('@/app/lib/@system/api', () => ({ api: mockApi }))

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
  vi.clearAllMocks()
  // Default: API returns no preferences (simulates unauthenticated user)
  mockApi.get.mockRejectedValue(new Error('Not authenticated'))
  mockApi.patch.mockRejectedValue(new Error('Not authenticated'))
})

describe('ThemeContext server sync', () => {
  it('defaults to light theme when server is unreachable', () => {
    const { result } = renderHook(() => useThemeContext(), { wrapper })
    expect(result.current.theme).toBe('light')
    expect(result.current.resolvedTheme).toBe('light')
  })

  it('restores stored theme from localStorage when server is unreachable', () => {
    localStorage.setItem('app-theme', 'dark')
    const { result } = renderHook(() => useThemeContext(), { wrapper })
    expect(result.current.theme).toBe('dark')
  })

  it('attempts to restore theme from server on mount', async () => {
    mockApi.get.mockResolvedValue({ preferences: { theme: 'dark' } })

    const { result } = renderHook(() => useThemeContext(), { wrapper })

    // The server theme is loaded asynchronously, so wait for it
    await vi.waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/users/me/preferences')
    })

    await vi.waitFor(() => {
      expect(result.current.theme).toBe('dark')
    })
  })

  it('does not override localStorage with server values when server theme is missing', async () => {
    // Server has no theme stored
    mockApi.get.mockResolvedValue({ preferences: {} })
    localStorage.setItem('app-theme', 'light')

    const { result } = renderHook(() => useThemeContext(), { wrapper })

    // Should keep localStorage value
    expect(result.current.theme).toBe('light')

    await vi.waitFor(() => {
      expect(mockApi.get).toHaveBeenCalled()
    })
  })

  it('calls PATCH /users/me/preferences when setting theme', async () => {
    mockApi.patch.mockResolvedValue({ preferences: { theme: 'dark' } })

    const { result } = renderHook(() => useThemeContext(), { wrapper })

    act(() => { result.current.setTheme('dark') })

    await vi.waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/users/me/preferences', { theme: 'dark' })
    })
  })

  it('still sets theme locally when server save fails', () => {
    mockApi.patch.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useThemeContext(), { wrapper })

    act(() => { result.current.setTheme('dark') })

    expect(result.current.theme).toBe('dark')
    expect(localStorage.getItem('app-theme')).toBe('dark')
  })

  it('persists system theme choice to server', async () => {
    mockApi.patch.mockResolvedValue({ preferences: { theme: 'system' } })

    const { result } = renderHook(() => useThemeContext(), { wrapper })

    act(() => { result.current.setTheme('system') })

    await vi.waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/users/me/preferences', { theme: 'system' })
    })
    expect(result.current.theme).toBe('system')
  })

  it('rejects invalid theme values without calling API', () => {
    const { result } = renderHook(() => useThemeContext(), { wrapper })

    act(() => { result.current.setTheme('sepia') })

    expect(result.current.theme).toBe('light') // unchanged
    expect(mockApi.patch).not.toHaveBeenCalled()
  })

  it('ignores server theme that is not a valid value', async () => {
    mockApi.get.mockResolvedValue({ preferences: { theme: 'neon' } })
    localStorage.setItem('app-theme', 'light')

    const { result } = renderHook(() => useThemeContext(), { wrapper })

    // Should keep the localStorage value since server returned invalid theme
    await vi.waitFor(() => { expect(mockApi.get).toHaveBeenCalled() })
    expect(result.current.theme).toBe('light')
  })
})