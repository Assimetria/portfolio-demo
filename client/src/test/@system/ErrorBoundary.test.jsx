// @system — ErrorBoundary component tests
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary, withErrorBoundary } from '@system/ErrorBoundary'

// Suppress console.error from React & ErrorBoundary during expected throws
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  console.error.mockRestore()
})

function ThrowingComponent({ shouldThrow = true }) {
  if (shouldThrow) throw new Error('Test error')
  return <div>All good</div>
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Hello</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('renders default error UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText(/try reloading the page/i)).toBeInTheDocument()
  })

  it('renders Try Again and Go Home buttons', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    )
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument()
  })

  it('resets error state when Try Again is clicked', async () => {
    const user = userEvent.setup()
    let shouldThrow = true

    function Controlled() {
      if (shouldThrow) throw new Error('boom')
      return <div>Recovered</div>
    }

    const { container } = render(
      <ErrorBoundary>
        <Controlled />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    // Stop throwing before clicking retry
    shouldThrow = false
    await user.click(screen.getByRole('button', { name: /try again/i }))

    expect(screen.getByText('Recovered')).toBeInTheDocument()
  })

  it('uses custom fallback when provided', () => {
    const fallback = ({ error, resetError }) => (
      <div>
        <span>Custom fallback</span>
        {error && <span>{error.message}</span>}
        <button onClick={resetError}>Reset</button>
      </div>
    )

    render(
      <ErrorBoundary fallback={fallback}>
        <ThrowingComponent />
      </ErrorBoundary>
    )
    expect(screen.getByText('Custom fallback')).toBeInTheDocument()
  })

  it('reports to Sentry when available', () => {
    const captureException = vi.fn()
    window.Sentry = { captureException }

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    )

    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ extra: expect.any(Object) })
    )

    delete window.Sentry
  })
})

describe('withErrorBoundary', () => {
  it('wraps a component with ErrorBoundary', () => {
    function MyComponent() {
      return <div>Wrapped</div>
    }
    const Wrapped = withErrorBoundary(MyComponent)

    render(<Wrapped />)
    expect(screen.getByText('Wrapped')).toBeInTheDocument()
  })

  it('sets a descriptive displayName', () => {
    function MyComponent() {
      return <div />
    }
    const Wrapped = withErrorBoundary(MyComponent)
    expect(Wrapped.displayName).toBe('withErrorBoundary(MyComponent)')
  })
})
