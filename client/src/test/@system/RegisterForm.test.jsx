// @system — Tests for RegisterForm component
import { render, screen } from '@testing-library/react'
import { RegisterForm } from '@/app/components/@system/RegisterForm'

jest.mock('@/app/lib/@system/api', () => ({
  api: { post: jest.fn() },
}))

describe('RegisterForm', () => {
  it('renders all three form fields', () => {
    render(<RegisterForm />)
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getAllByPlaceholderText(/••••/)).toHaveLength(2)
  })

  it('renders create account button', () => {
    render(<RegisterForm />)
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('has required field indicators', () => {
    render(<RegisterForm />)
    // Three fields should be marked as required via FormField
    const requiredMarks = screen.getAllByText('*')
    expect(requiredMarks.length).toBe(3)
  })

  it('has correct input types', () => {
    render(<RegisterForm />)
    expect(screen.getByPlaceholderText('you@example.com')).toHaveAttribute('type', 'email')
    const pwFields = screen.getAllByPlaceholderText(/••••/)
    expect(pwFields[0]).toHaveAttribute('type', 'password')
    expect(pwFields[1]).toHaveAttribute('type', 'password')
  })
})
