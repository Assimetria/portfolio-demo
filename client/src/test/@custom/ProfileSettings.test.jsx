// @system — ProfileSettings tests with rate limit handling
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '../test-utils'
import userEvent from '@testing-library/user-event'
import { ProfileSettings } from '@/app/components/@system/UserSettings/ProfileSettings'

const baseUser = () => ({
  name: 'Test User',
  email: 'test@example.com',
  bio: 'A test bio',
})

describe('ProfileSettings — rate limit handling', () => {
  let user

  beforeEach(() => {
    user = userEvent.setup()
  })

  it('renders the profile form without errors', () => {
    render(<ProfileSettings user={baseUser()} />)
    expect(screen.getByText('Public profile')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Test User')).toBeInTheDocument()
  })

  it('shows rate limit warning when onUpdate throws a 429 error', async () => {
    const onUpdate = vi.fn().mockRejectedValue({
      status: 429,
      message: 'Too many profile requests. Please try again later.',
    })

    render(<ProfileSettings user={baseUser()} onUpdate={onUpdate} />)

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument()
      expect(
        screen.getByText('Too many profile requests. Please try again later.')
      ).toBeInTheDocument()
    })
  })

  it('shows rate limit warning when onUpdate throws Error with "Too many" message', async () => {
    const onUpdate = vi.fn().mockRejectedValue({
      status: 429,
      message: 'Too many requests. Please slow down and try again later.',
    })

    render(<ProfileSettings user={baseUser()} onUpdate={onUpdate} />)

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument()
    })
  })

  it('clears rate limit warning on subsequent form submission', async () => {
    // First submission fails with 429
    const onUpdate = vi
      .fn()
      .mockRejectedValueOnce({
        status: 429,
        message: 'Too many profile requests.',
      })
      .mockResolvedValueOnce({ success: true })

    render(<ProfileSettings user={baseUser()} onUpdate={onUpdate} />)

    const saveButton = screen.getByRole('button', { name: /save changes/i })

    // First click — rate limited
    await user.click(saveButton)
    await waitFor(() => {
      expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument()
    })

    // Second click — success, warning should clear
    await user.click(saveButton)
    await waitFor(() => {
      expect(screen.queryByText('Rate limit exceeded')).not.toBeInTheDocument()
    })
  })

  it('does not show rate limit warning for non-429 errors', async () => {
    const onUpdate = vi.fn().mockRejectedValue({
      status: 400,
      message: 'Validation error',
    })

    render(<ProfileSettings user={baseUser()} onUpdate={onUpdate} />)

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(screen.queryByText('Rate limit exceeded')).not.toBeInTheDocument()
    })
  })
})