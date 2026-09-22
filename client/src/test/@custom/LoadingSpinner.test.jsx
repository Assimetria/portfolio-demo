import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingSpinner } from '@/app/components/@custom/LoadingSpinner'

describe('LoadingSpinner', () => {
  it('renders with default accessible role and label', () => {
    render(<LoadingSpinner />)
    const status = screen.getByRole('status')
    expect(status).toBeInTheDocument()
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Loading')).toBeInTheDocument()
  })

  it('renders provided label', () => {
    render(<LoadingSpinner label="Fetching data..." />)
    expect(screen.getByText('Fetching data...')).toBeInTheDocument()
  })

  it('applies additional className', () => {
    render(<LoadingSpinner className="custom-class" />)
    expect(screen.getByRole('status')).toHaveClass('custom-class')
  })

  it('wraps in a fullscreen overlay when fullScreen is set', () => {
    const { container } = render(<LoadingSpinner fullScreen />)
    const overlay = container.querySelector('.fixed.inset-0')
    expect(overlay).not.toBeNull()
  })

  it('accepts a numeric size', () => {
    const { container } = render(<LoadingSpinner size={40} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '40')
  })
})
