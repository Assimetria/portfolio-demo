// @system — public thank-you page: shown after signup, checkout, or any
// conversion funnel reaches a successful end state that links here.
import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react'
import { Header } from '../../../../components/@system/Header'
import { Footer } from '../../../../components/@system/Footer'
import { Card, CardContent } from '../../../../components/@system/Card'
import { Button } from '../../../../components/@system/ui/button'
import { info } from '@/config'

const DEFAULT_TITLE = "You're all set!"
const DEFAULT_MESSAGE =
  "Thanks for choosing {app}. If there's anything you need to complete next, we've laid it out below."

export function ThankYouPage() {
  const [searchParams] = useSearchParams()

  // Allow campaigns to customise the message without hardcoding a new page.
  const title = searchParams.get('title') || DEFAULT_TITLE
  const nextLabel = searchParams.get('nextLabel') || 'Continue to dashboard'
  const nextHref = searchParams.get('nextHref') || '/app'

  const body = DEFAULT_MESSAGE.replace('{app}', info.name)

  useEffect(() => {
    document.title = `${title} — ${info.name}`
  }, [title])

  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />
      <main id="main-content" className="container mx-auto px-4 py-16 flex justify-center">
        <div className="w-full max-w-lg space-y-6">
          <Card>
            <CardContent className="pt-10 pb-10 text-center space-y-4">
              <div className="flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary/10">
                  <CheckCircle2 className="h-8 w-8 text-[var(--color-success)]" />
                </div>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              <p className="text-sm text-brand-text-muted leading-relaxed">{body}</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Button asChild>
                  <Link to={nextHref}>
                    {nextLabel} <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-brand-text-muted">
            Questions? Contact us at{' '}
            <a
              href={`mailto:${info.supportEmail}`}
              className="text-primary underline underline-offset-4 hover:opacity-80"
            >
              {info.supportEmail}
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
