// @system — public unsubscribe page.
// One-click unsubscribe links sent from marketing email point to
// /unsubscribe?email=<addr> or /unsubscribe?token=<signed token>. On mount this
// calls the existing GET /api/users/unsubscribe endpoint and confirms the opt-out.
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MailX, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { api } from '../../../../lib/@system/api'
import { Card, CardContent } from '../../../../components/@system/Card'
import { Button } from '../../../../components/@system/ui/button'
import { info } from '@/config'

const TITLES = {
  working: 'Unsubscribing…',
  done: 'Unsubscribed',
  error: 'Something went wrong',
  missing: 'Invalid unsubscribe link',
}

export function UnsubscribePage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const email = searchParams.get('email')

  const [status, setStatus] = useState(token || email ? 'working' : 'missing')
  const [errorMessage, setErrorMessage] = useState('')
  const ran = useRef(false)

  // Brand the browser tab title so the state is obvious in history/tabs even
  // before the async request settles.
  useEffect(() => {
    document.title = `${TITLES[status]} — ${info.name}`
  }, [status])

  useEffect(() => {
    if ((!token && !email) || ran.current) return
    ran.current = true

    const query = new URLSearchParams()
    if (token) query.set('token', token)
    if (email) query.set('email', email)

    api
      .get(`/users/unsubscribe?${query.toString()}`)
      .then(() => setStatus('done'))
      .catch((err) => {
        setStatus('error')
        setErrorMessage(err.message)
      })
  }, [token, email])

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight text-brand-text">
            <img src={info.logo} alt="" className="h-8 w-8" />
            {info.name}
          </Link>
        </div>

        <Card>
          {/* Status region: swaps between working / done / error / missing as the
              unsubscribe request resolves, so assistive tech is notified via the
              polite live region rather than silently swapping content. */}
          <CardContent
            className="pt-8 pb-8 text-center space-y-4"
            role="status"
            aria-live="polite"
          >
            {/* Working */}
            {status === 'working' && (
              <>
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand-text-muted" />
                <h1 className="text-xl font-semibold">Unsubscribing…</h1>
                <p className="text-sm text-brand-text-muted">Just a moment, please.</p>
              </>
            )}

            {/* Done */}
            {status === 'done' && (
              <>
                <CheckCircle2 className="mx-auto h-12 w-12 text-[var(--color-success)]" />
                <h1 className="text-xl font-semibold">You&apos;re unsubscribed</h1>
                <p className="text-sm text-brand-text-muted leading-relaxed">
                  You&apos;ve been removed from marketing emails from {info.name}. You&apos;ll still
                  receive important account and transactional messages.
                </p>
                <div className="flex flex-col gap-2 pt-2">
                  <Button asChild variant="outline">
                    <Link to="/">Back to home</Link>
                  </Button>
                  <p className="text-xs text-brand-text-muted">
                    Changed your mind? Reset your preferences in your account{' '}
                    <Link to="/app/settings" className="text-primary underline underline-offset-4 hover:opacity-80">
                      notification settings
                    </Link>
                    .
                  </p>
                </div>
              </>
            )}

            {/* Error */}
            {status === 'error' && (
              <>
                <AlertCircle className="mx-auto h-12 w-12 text-[var(--color-error)]" />
                <h1 className="text-xl font-semibold">Something went wrong</h1>
                <p className="text-sm text-brand-text-muted leading-relaxed">
                  {errorMessage || "We couldn't process your unsubscribe request. Please try again."}
                </p>
                <Button asChild variant="outline">
                  <Link to="/">Back to home</Link>
                </Button>
              </>
            )}

            {/* Missing params */}
            {status === 'missing' && (
              <>
                <MailX className="mx-auto h-12 w-12 text-brand-text-muted" />
                <h1 className="text-xl font-semibold">Unsubscribe link invalid</h1>
                <p className="text-sm text-brand-text-muted leading-relaxed">
                  This link is missing the information needed to unsubscribe. Use the link from the
                  email itself, or manage your preferences in your account settings.
                </p>
                <Button asChild variant="outline">
                  <Link to="/app/settings">Manage notification settings</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
