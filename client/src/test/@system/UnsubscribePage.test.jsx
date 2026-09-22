// @system — Tests for UnsubscribePage static page
import { render, screen, waitFor } from '../test-utils'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { api } from '@/app/lib/@system/api'
import { UnsubscribePage } from '@/app/pages/static/@system/UnsubscribePage'

jest.mock('@/config', () => ({
  info: { name: 'Acme', logo: '/logo.svg', supportEmail: 'hi@acme.dev' },
}))

jest.mock('@/app/lib/@system/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), del: jest.fn() },
}))

function renderUnsubscribe(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/unsubscribe" element={<UnsubscribePage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('UnsubscribePage', () => {
  afterEach(() => {
    api.get.mockReset()
  })

  it('calls the unsubscribe endpoint with the email then shows a success state', async () => {
    api.get.mockResolvedValue({ ok: true })

    renderUnsubscribe('/unsubscribe?email=lead@example.com')

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        '/users/unsubscribe?email=lead%40example.com'
      )
    )

    expect((await screen.findByRole('heading', { name: "You're unsubscribed" }))).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledTimes(1)
  })

  it('passes a signed token when provided instead of an email', async () => {
    api.get.mockResolvedValue({ ok: true })

    renderUnsubscribe('/unsubscribe?token=abc.123')

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/users/unsubscribe?token=abc.123')
    )
  })

  it('surfaces an error message when the request fails', async () => {
    api.get.mockRejectedValue(new Error('Something went wrong on our end.'))

    renderUnsubscribe('/unsubscribe?email=lead@example.com')

    expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.getByText('Something went wrong on our end.')).toBeInTheDocument()
  })

  it('explains the link is invalid when no identifiers are present', async () => {
    renderUnsubscribe('/unsubscribe')

    expect(screen.getByRole('heading', { name: 'Unsubscribe link invalid' })).toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalled()
  })

  it('offers a route back to notification settings after unsubscribing', async () => {
    api.get.mockResolvedValue({ ok: true })

    renderUnsubscribe('/unsubscribe?email=lead@example.com')

    const settingsLink = await screen.findByRole('link', { name: /notification settings/i })
    expect(settingsLink).toHaveAttribute('href', '/app/settings')
  })

  it('sets a branded browser tab title', async () => {
    renderUnsubscribe('/unsubscribe')
    expect(document.title).toBe('Invalid unsubscribe link — Acme')

    api.get.mockResolvedValue({ ok: true })
    renderUnsubscribe('/unsubscribe?email=lead@example.com')
    expect((await screen.findByRole('heading', { name: "You're unsubscribed" }))).toBeInTheDocument()
    expect(document.title).toBe('Unsubscribed — Acme')
  })
})
