// @system — Tests for NotificationSettings saving to the communication_preferences API
// (cookie-session auth: requests carry credentials: 'include', never a bearer token)
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationSettings } from '@/app/components/@system/UserSettings/NotificationSettings'

afterEach(() => {
  jest.restoreAllMocks()
})

beforeEach(() => {
  try {
    window.localStorage.clear()
  } catch { /* noop */ }
})

describe('NotificationSettings', () => {
  it('persists the weekly digest toggle to /api/communications/update', async () => {
    const user = userEvent.setup()
    const onUpdate = jest.fn()

    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) })

    render(<NotificationSettings user={{}} onUpdate={onUpdate} />)

    // Weekly digest starts off (server default); enable it to create a change.
    await user.click(screen.getByRole('switch', { name: /weekly digest/i }))

    const save = screen.getByRole('button', { name: /save changes/i })
    await user.click(save)

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/communications/update',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          email_marketing: true,
          product_updates: true,
          weekly_digest: true,
          in_app_notifications: true,
        }),
      }),
    )
    expect(onUpdate).toHaveBeenCalledWith({
      notificationPreferences: expect.objectContaining({ weeklyDigest: true }),
    })
  })

  it('authenticates with the session cookie — no bearer token from localStorage', async () => {
    const user = userEvent.setup()
    const onUpdate = jest.fn()
    window.localStorage.setItem('token', 'stale-token-must-be-ignored')

    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) })

    render(<NotificationSettings user={{}} onUpdate={onUpdate} />)
    await user.click(screen.getByRole('switch', { name: /weekly digest/i }))
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    const init = global.fetch.mock.calls[0][1]
    expect(init.credentials).toBe('include')
    expect(init.headers?.Authorization).toBeUndefined()
  })
})
