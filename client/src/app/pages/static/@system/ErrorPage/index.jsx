// @system — Error / block page shown when something goes wrong
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '../../../../components/@system/ui/button'
import { Header } from '../../../../components/@system/Header'
import { Footer } from '../../../../components/@system/Footer'
import { info } from '@/config'

export function ErrorPage() {
  const [params] = useSearchParams()
  const code = params.get('code') || '500'
  const message = params.get('message') || 'Something went wrong'
  const detail = params.get('detail')

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <Header />

      <main id="main-content" className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-error-bg)] mb-6">
          <AlertTriangle className="h-7 w-7 text-[var(--color-error)]" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-widest text-[var(--color-error)] mb-4">
          Error {code}
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
          {message}
        </h1>
        {detail && (
          <p className="text-brand-text-muted max-w-md mb-2 text-sm">
            {detail}
          </p>
        )}
        <p className="text-brand-text-muted max-w-sm mb-8 text-sm">
          If the problem persists, please contact{' '}
          <a href={`mailto:${info.supportEmail}`} className="text-brand-primary hover:underline">
            support
          </a>.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => window.location.reload()} variant="default" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Try Again
          </Button>
          <Button variant="outline" asChild>
            <Link to="/">Go to homepage</Link>
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  )
}
