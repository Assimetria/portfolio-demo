// @system — Error boundary component to catch and display React errors
// Prevents the entire app from crashing when a component throws
//
// Usage:
// <ErrorBoundary>
//   <YourComponent />
// </ErrorBoundary>

import { Component } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardContent } from '../Card'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({
      error,
      errorInfo,
    })

    // Log to error reporting service (e.g., Sentry)
    if (window.Sentry) {
      window.Sentry.captureException(error, {
        extra: errorInfo,
      })
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props

      // Use custom fallback if provided
      if (fallback) {
        return fallback({
          error: this.state.error,
          errorInfo: this.state.errorInfo,
          resetError: this.handleReset,
        })
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-brand-bg">
          <Card className="max-w-lg w-full">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="rounded-full bg-[var(--color-error-bg)] p-3 mb-4">
                  <AlertTriangle className="h-8 w-8 text-[var(--color-error)]" />
                </div>
                
                <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
                <p className="text-sm text-brand-text-muted mb-6 max-w-md">
                  We're sorry, but something unexpected happened. Our team has been notified.
                  You can try reloading the page or going back home.
                </p>

                {/* Error details (dev mode) */}
                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <details className="w-full mb-6 text-left">
                    <summary className="text-xs font-medium cursor-pointer text-brand-text-muted hover:text-brand-text mb-2">
                      Error Details
                    </summary>
                    <div className="text-xs bg-brand-surface p-3 rounded-lg overflow-auto max-h-48">
                      <pre className="whitespace-pre-wrap">
                        {this.state.error.toString()}
                        {this.state.errorInfo?.componentStack}
                      </pre>
                    </div>
                  </details>
                )}

                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Button
                    onClick={this.handleReset}
                    variant="default"
                    className="gap-2 w-full sm:w-auto"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try Again
                  </Button>
                  <Button
                    onClick={this.handleGoHome}
                    variant="outline"
                    className="gap-2 w-full sm:w-auto"
                  >
                    <Home className="h-4 w-4" />
                    Go Home
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * withErrorBoundary — Higher-order component to wrap components with error boundary
 * @param {React.ComponentType} Component - Component to wrap
 * @param {Object} [options] - Error boundary options
 * @param {Function} [options.fallback] - Custom fallback UI function
 * @returns {React.ComponentType} Wrapped component
 */
export function withErrorBoundary(Component, options = {}) {
  const WrappedComponent = (props) => (
    <ErrorBoundary {...options}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`

  return WrappedComponent
}
