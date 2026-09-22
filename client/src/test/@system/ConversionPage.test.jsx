// @system — Tests for ConversionPage static page
import { render, screen } from '../test-utils'
import { MemoryRouter } from 'react-router-dom'
import { ConversionPage } from '@/app/pages/static/@system/ConversionPage'

// Header/Footer pull in auth/theme/nav stores; stub chrome so the unit test
// focuses on ConversionPage's own marketing content.
jest.mock('@/app/components/@system/Header', () => ({
  Header: () => <header data-testid="header" />,
}))

jest.mock('@/app/components/@system/Footer', () => ({
  Footer: () => <footer data-testid="footer" />,
}))

jest.mock('@/config', () => ({
  info: { name: 'Acme', tagline: 'Ship faster.', logo: '/logo.svg', supportEmail: 'hi@acme.dev' },
}))

describe('ConversionPage', () => {
  it('renders a primary headline with the product name', () => {
    render(
      <MemoryRouter>
        <ConversionPage />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: /Start building with Acme/i })).toBeInTheDocument()
    expect(screen.getByText(/Ship faster/i)).toBeInTheDocument()
  })

  it('links the CTA to the registration flow', () => {
    render(
      <MemoryRouter>
        <ConversionPage />
      </MemoryRouter>
    )

    const cta = screen.getByRole('link', { name: /Get started free/i })
    expect(cta).toHaveAttribute('href', '/auth?tab=register')
  })

  it('lists value-proposition highlights', () => {
    render(
      <MemoryRouter>
        <ConversionPage />
      </MemoryRouter>
    )

    for (const heading of ['Launch fast', 'Secure by default', 'Built to grow']) {
      expect(screen.getByText(heading)).toBeInTheDocument()
    }
  })

  it('renders the static page chrome wrappers', () => {
    render(
      <MemoryRouter>
        <ConversionPage />
      </MemoryRouter>
    )

    expect(screen.getByTestId('header')).toBeInTheDocument()
    expect(screen.getByTestId('footer')).toBeInTheDocument()
  })

  it('sets a branded browser tab title', () => {
    render(
      <MemoryRouter>
        <ConversionPage />
      </MemoryRouter>
    )

    expect(document.title).toBe('Start building with Acme')
  })
})
