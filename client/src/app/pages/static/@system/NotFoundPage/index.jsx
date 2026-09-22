// @system — 404 Not Found page shown for all unmatched routes
import { Link } from 'react-router-dom'
import { Button } from '../../../../components/@system/ui/button'
import { Header } from '../../../../components/@system/Header'
import { Footer } from '../../../../components/@system/Footer'
import { text } from '@/config'

const t = text.notFound ?? {}

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <Header />

      <main id="main-content" className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-primary mb-4">
          404
        </p>
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          {t.title ?? 'Page not found'}
        </h1>
        <p className="text-brand-text-muted max-w-sm mb-8">
          {t.subtitle ?? "Sorry, we couldn't find the page you're looking for. It may have been moved, deleted, or the URL might be incorrect."}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link to="/">{t.cta ?? 'Go to homepage'}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/help">Visit help center</Link>
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  )
}
