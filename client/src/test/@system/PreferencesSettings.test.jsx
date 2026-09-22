// @system — PreferencesSettings tests
// Verifies the appearance theme control is lifted out of local state and wired to
// the shared ThemeProvider (persisting to localStorage['app-theme']), while account
// preferences (language/timezone/etc.) still round-trip through onUpdate on Save.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '../test-utils'
import userEvent from '@testing-library/user-event'
import { PreferencesSettings } from '@/app/components/@system/UserSettings/PreferencesSettings'
import { ThemeProvider } from '@/app/store/@system/theme'

vi.mock('@/config', () => ({ info: { defaultTheme: 'light' } }))

let mediaListeners = []
const mockMatchMedia = () => ({
  matches: false,
  media: '(prefers-color-scheme: dark)',
  addEventListener: (_, cb) => mediaListeners.push(cb),
  removeEventListener: (_, cb) => { mediaListeners = mediaListeners.filter((l) => l !== cb) },
  addListener: () => {},
  removeListener: () => {},
  onchange: null,
  dispatchEvent: () => {},
})

const baseUser = () => ({
  preferences: {
    theme: 'system',
    language: 'en',
    timezone: 'UTC',
    dateFormat: 'MM/DD/YYYY',
    compactMode: false,
    sidebarCollapsed: false,
  },
})

const renderWithTheme = (ui) =>
  render(<ThemeProvider>{ui}</ThemeProvider>)

beforeEach(() => {
  localStorage.clear()
  mediaListeners = []
  document.documentElement.classList.remove('dark')
  window.matchMedia = mockMatchMedia
})

describe('PreferencesSettings – theme lift', () => {
  it('renders the three theme options', () => {
    renderWithTheme(<PreferencesSettings user={baseUser()} />)
    expect(screen.getByText('Theme')).toBeInTheDocument()
    const options = screen.getAllByText(/Light|Dark|System/)
    expect(options.length).toBeGreaterThanOrEqual(3)
  })

  it('selecting a theme persists to localStorage["app-theme"] via the provider', async () => {
    const user = userEvent.setup()
    renderWithTheme(<PreferencesSettings user={baseUser()} />, { user })

    expect(window.localStorage.getItem('app-theme')).toBeNull()

    const dark = screen.getByText('Dark')
    await user.click(dark)

    await waitFor(() => {
      expect(window.localStorage.getItem('app-theme')).toBe('dark')
    })
  })

  it('still saves account preferences through onUpdate after a change', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn(async () => {})

    renderWithTheme(<PreferencesSettings user={baseUser()} onUpdate={onUpdate} />)

    // Toggle a non-theme account preference so only the runtime preferences differ.
    const compactSwitch = screen.getAllByRole('switch')[0]
    await user.click(compactSwitch)

    const save = screen.getByRole('button', { name: /save changes/i })
    expect(save).toBeTruthy()

    await user.click(save)

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          preferences: expect.objectContaining({ compactMode: true }),
        }),
      )
    })
  })
})
