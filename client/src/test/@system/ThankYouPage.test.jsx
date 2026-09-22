// @system — Tests for ThankYouPage static page
import { render, screen } from '../test-utils'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThankYouPage } from '@/app/pages/static/@system/ThankYouPage'

jest.mock('@/app/components/@system/Header', () => ({
  Header: () => <header data-testid="header" />,
}))

jest.mock('@/app/components/@system/Footer', () => ({
  Footer: () => <footer data-testid="footer" />,
}))

jest.mock('@/config', () => ({
  info: { name: 'Acme', logo: '/logo.svg', supportEmail: 'hi@acme.dev' },
}))

function renderThankYou(initialPath = '/thank-you') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/thank-you" element={<ThankYouPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ThankYouPage', () => {
  it('shows a success confirmation by default', () => {
    renderThankYou()
    expect(screen.getByRole('heading', { name: "You're all set!" })).toBeInTheDocument()
    expect(screen.getByText(/Thanks for choosing Acme/i)).toBeInTheDocument()
  })

  it('provides a primary action into the product dashboard', () => {
    renderThankYou()
    expect(screen.getByRole('link', { name: /Continue to dashboard/i })).toHaveAttribute('href', '/app')
  })

  it('surfaces a contact link using the configured support email', () => {
    renderThankYou()
    expect(screen.getByText('hi@acme.dev')).toHaveAttribute('href', 'mailto:hi@acme.dev')
  })

  it('respects campaign query overrides', () => {
    renderThankYou('/thank-you?title=Welcome aboard&nextLabel=Go to team&nextHref=/app/settings')
    expect(screen.getByRole('heading', { name: 'Welcome aboard' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Go to team/i })).toHaveAttribute('href', '/app/settings')
  })

  it('renders the header and footer chrome', () => {
    renderThankYou()
    expect(screen.getByTestId('header')).toBeInTheDocument()
    expect(screen.getByTestId('footer')).toBeInTheDocument()
  })

  it('sets a branded browser tab title reflecting campaign overrides', () => {
    renderThankYou()
    expect(document.title).toBe("You're all set! — Acme")

    renderThankYou('/thank-you?title=Welcome&nextHref=/app')
    expect(document.title).toBe('Welcome — Acme')
  })
})
