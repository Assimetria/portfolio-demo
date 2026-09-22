// @system — Tests for OAuthButtons component
import { render, screen, userEvent } from '../test-utils'
import { OAuthButtons } from '@/app/components/@system/OAuthButtons'

describe('OAuthButtons', () => {
  it('renders Google OAuth button', () => {
    render(<OAuthButtons />)
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
  })

  it('shows divider by default', () => {
    render(<OAuthButtons />)
    expect(screen.getByText(/or continue with/i)).toBeInTheDocument()
  })

  it('hides divider when showDivider=false', () => {
    render(<OAuthButtons showDivider={false} />)
    expect(screen.queryByText(/or continue with/i)).not.toBeInTheDocument()
  })

  it('redirects to /api/auth/google on click', async () => {
    // Mock window.location
    const originalLocation = window.location
    delete window.location
    window.location = { href: '' }

    const user = userEvent.setup()
    render(<OAuthButtons />)

    await user.click(screen.getByRole('button', { name: /continue with google/i }))
    expect(window.location.href).toBe('/api/auth/google')

    window.location = originalLocation
  })

  it('applies custom className', () => {
    const { container } = render(<OAuthButtons className="mt-8" />)
    expect(container.firstChild).toHaveClass('mt-8')
  })
})
