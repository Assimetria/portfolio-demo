// @system — Billing page with Stripe checkout integration
import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  RefreshCw,
  Sparkles } from 'lucide-react'
import { DashboardLayout } from '../../../../components/@system/Dashboard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/@system/Card'
import { Button } from '../../../../components/@system/ui/button'
import { Modal } from '../../../../components/@system/Modal'
import { Textarea } from '../../../../components/@system/Textarea'
import { Badge } from '../../../../components/@system/Badge'
import { useAuthContext } from '../../../../store/@system/auth'
import { useUpgradeModal } from '../../../../store/@system/upgradeModal'
import { isFreeUser } from '../../../../lib/@system/plans'
import {
  getMySubscription,
  getPlans,
  createCheckoutSession,
  createPortalSession,
  cancelSubscription,
  uncancelSubscription,
  formatAmount,
  formatInterval } from '../../../../api/@system/stripe'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function statusBadgeVariant(status) {
  switch (status) {
    case 'active':    return 'default'
    case 'trialing':  return 'secondary'
    case 'past_due':  return 'destructive'
    case 'cancelled': return 'destructive'
    default:          return 'outline'
  }
}

function statusLabel(status, cancelAtPeriodEnd) {
  if (status === 'active' && cancelAtPeriodEnd) return 'Cancelling'
  switch (status) {
    case 'active':    return 'Active'
    case 'trialing':  return 'Trial'
    case 'past_due':  return 'Past Due'
    case 'cancelled': return 'Cancelled'
    default:          return 'Inactive'
  }
}

// Preset reasons shown in the guided cancellation survey. The selected value is
// sent to the server as `reason` and persisted in the subscription metadata.
const CANCEL_REASONS = [
  { value: 'too_expensive',     label: 'It\u2019s too expensive' },
  { value: 'missing_features',  label: 'Missing features I need' },
  { value: 'not_using',         label: 'I don\u2019t use it enough' },
  { value: 'technical_problems',label: 'Technical problems or bugs' },
  { value: 'switching',         label: 'Switching to another service' },
  { value: 'other',             label: 'Something else' },
]

// ── Main page ─────────────────────────────────────────────────────────────────

export function BillingPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuthContext()
  const { openUpgrade } = useUpgradeModal()
  const isFreePlan = isFreeUser(user)

  const [subscription, setSubscription] = useState(null)
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [error, setError] = useState('')
  const [showSuccess, setShowSuccess] = useState(searchParams.get('checkout') === 'success')

  // Guided cancellation survey state
  const [showCancelSurvey, setShowCancelSurvey] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [cancelFeedback, setCancelFeedback] = useState('')
  const [surveyError, setSurveyError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [subRes, plansRes] = await Promise.all([getMySubscription(), getPlans()])
      setSubscription(subRes.subscription)
      setPlans(plansRes.plans)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing info')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Strip ?checkout=success from the URL after showing the banner
  useEffect(() => {
    if (showSuccess) {
      const next = new URLSearchParams(searchParams)
      next.delete('checkout')
      setSearchParams(next, { replace: true })
    }
  }, [showSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCheckout(priceId) {
    setActionLoading(priceId)
    setError('')
    try {
      await createCheckoutSession(priceId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout')
      setActionLoading(null)
    }
  }

  async function handlePortal() {
    setActionLoading('portal')
    setError('')
    try {
      await createPortalSession()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal')
      setActionLoading(null)
    }
  }

  // Opens the guided cancellation survey instead of a bare window.confirm prompt.
  function handleCancel() {
    setSurveyError('')
    setCancelReason('')
    setCustomReason('')
    setCancelFeedback('')
    setShowCancelSurvey(true)
  }

  function closeCancelSurvey() {
    if (actionLoading === 'cancel') return
    setShowCancelSurvey(false)
    setSurveyError('')
  }

  // Performs the actual cancellation using the reason + free-text feedback the
  // user selected in the survey. Sends the payload to the backend so it can be
  // persisted alongside the cancelled subscription.
  async function handleConfirmCancel() {
    // "Something else / Other" uses the free-text detail as the actual reason, so a
    // blank detail collapses to the same "please tell us why" validation below
    // instead of silently cancelling with an empty "other" reason.
    const reason = cancelReason === 'other'
      ? customReason.trim()
      : cancelReason
    if (!reason) {
      setSurveyError('Please tell us why you\u2019re cancelling.')
      return
    }
    const feedback = cancelFeedback.trim() || undefined

    setActionLoading('cancel')
    setError('')
    try {
      await cancelSubscription({ reason, feedback })
      setShowCancelSurvey(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleUncancel() {
    setActionLoading('uncancel')
    setError('')
    try {
      await uncancelSubscription()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reverse cancellation')
    } finally {
      setActionLoading(null)
    }
  }

  const hasActiveSub = subscription && ['active', 'trialing'].includes(subscription.status)

  return (
    <DashboardLayout>
      <DashboardLayout.Content className="max-w-3xl">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Billing</h1>
              <p className="mt-1 text-brand-text-muted">Manage your subscription and payment details.</p>
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* ── Banners ── */}
          {showSuccess && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-[var(--color-success)] bg-[var(--color-success-bg)] p-4 dark:border-[var(--color-success)] dark:bg-[var(--color-success-bg)]">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-success)]" />
              <div className="flex-1">
                <p className="font-medium text-[var(--color-success)] dark:text-[var(--color-success)]">Payment successful!</p>
                <p className="mt-0.5 text-sm text-[var(--color-success)] dark:text-[var(--color-success)]">
                  Your subscription is now active. It may take a moment to reflect below.
                </p>
              </div>
              <button onClick={() => setShowSuccess(false)} className="text-[var(--color-success)] hover:text-[var(--color-success)]" aria-label="Dismiss">
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          )}
          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/30 bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error)]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-brand-text-muted py-8">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading billing info…
            </div>
          ) : (
            <>
              {/* ── Current subscription ── */}
              <Card className="mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Current Plan</CardTitle>
                    {subscription && (
                      <Badge variant={statusBadgeVariant(subscription.status)}>
                        {statusLabel(subscription.status, subscription.cancel_at_period_end)}
                      </Badge>
                    )}
                  </div>
                  <CardDescription>Your active Stripe subscription.</CardDescription>
                </CardHeader>
                <CardContent>
                  {subscription ? (
                    <div className="space-y-4">
                      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
                        <div>
                          <dt className="text-brand-text-muted">Subscription ID</dt>
                          <dd className="mt-0.5 font-mono text-xs break-all">{subscription.stripe_subscription_id}</dd>
                        </div>
                        <div>
                          <dt className="text-brand-text-muted">Status</dt>
                          <dd className="mt-0.5 capitalize">{subscription.status}</dd>
                        </div>
                        <div>
                          <dt className="text-brand-text-muted">Period start</dt>
                          <dd className="mt-0.5">{formatDate(subscription.current_period_start)}</dd>
                        </div>
                        <div>
                          <dt className="text-brand-text-muted">{subscription.cancel_at_period_end ? 'Access until' : 'Renews'}</dt>
                          <dd className="mt-0.5">{formatDate(subscription.current_period_end)}</dd>
                        </div>
                      </dl>

                      {subscription.cancel_at_period_end && (
                        <p className="rounded bg-[var(--color-warning-bg)] px-3 py-2 text-sm text-[var(--color-warning)] dark:bg-[var(--color-warning-bg)] dark:text-[var(--color-warning)]">
                          Your subscription will not renew after {formatDate(subscription.current_period_end)}.
                        </p>
                      )}

                      {subscription.status === 'past_due' && (
                        <p className="text-sm text-[var(--color-error)]">
                          Your last payment failed. Update your payment method to avoid interruption.
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2 border-t pt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePortal}
                          disabled={!!actionLoading}
                          className="gap-2"
                        >
                          {actionLoading === 'portal' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                          Manage Billing
                        </Button>

                        {hasActiveSub && !subscription.cancel_at_period_end && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openUpgrade('Settings · Billing')}
                            disabled={!!actionLoading}
                            className="gap-2"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            Change plan
                          </Button>
                        )}

                        {hasActiveSub && !subscription.cancel_at_period_end && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancel}
                            disabled={!!actionLoading}
                            className="text-[var(--color-error)] hover:text-[var(--color-error)] gap-2"
                          >
                            {actionLoading === 'cancel' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Cancel Plan
                          </Button>
                        )}

                        {hasActiveSub && subscription.cancel_at_period_end && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleUncancel}
                            disabled={!!actionLoading}
                            className="gap-2"
                          >
                            {actionLoading === 'uncancel' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Keep My Plan
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : isFreePlan ? (
                    <div className="space-y-3">
                      <p className="text-sm text-brand-text-muted">
                        You are on the free plan. Upgrade to unlock paid features and higher limits.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => openUpgrade('Settings · Billing')} className="gap-2">
                          <Sparkles className="h-4 w-4" />
                          Upgrade plan
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link to="/pricing">Compare plans</Link>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-brand-text-muted">You don't have an active subscription.</p>
                      <Button asChild size="sm">
                        <Link to="/pricing">View Plans</Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Available plans — only shown when no active subscription ── */}
              {!hasActiveSub && plans.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-4">Choose a Plan</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {plans.map((plan) => (
                      <Card key={plan.priceId} className="relative">
                        {plan.metadata?.popular === 'true' && (
                          <div className="absolute -top-2.5 left-4">
                            <Badge>Most Popular</Badge>
                          </div>
                        )}
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">{plan.name}</CardTitle>
                          {plan.description && <CardDescription className="text-xs">{plan.description}</CardDescription>}
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <span className="text-2xl font-bold">{formatAmount(plan.amount, plan.currency)}</span>
                            <span className="text-brand-text-muted text-sm">{formatInterval(plan.interval, plan.intervalCount)}</span>
                          </div>
                          {plan.trialDays && (
                            <p className="text-xs text-brand-text-muted">{plan.trialDays}-day free trial included</p>
                          )}
                          <Button
                            className="w-full gap-2"
                            size="sm"
                            onClick={() =>
                              isFreePlan
                                ? openUpgrade('Settings · Billing')
                                : handleCheckout(plan.priceId)
                            }
                            disabled={!!actionLoading}
                          >
                            {!isFreePlan && actionLoading === plan.priceId
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <ExternalLink className="h-4 w-4" />}
                            {isFreePlan ? `Choose ${plan.name}` : `Get ${plan.name}`}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Footer ── */}
              <p className="mt-10 text-xs text-brand-text-muted">
                Payments are securely processed by Stripe. We never store your card details.
              </p>
            </>
          )}
      </DashboardLayout.Content>

        {/* ── Guided cancellation survey ── */}
        <Modal
          open={showCancelSurvey}
          onClose={closeCancelSurvey}
          title={'We\u2019re sorry to see you go'}
          description={'Tell us why you\u2019re cancelling so we can improve. You\u2019ll keep access until the end of the current billing period.'}
        >
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-brand-text">Why are you cancelling?</legend>
            {CANCEL_REASONS.map((option) => (
              <label
                key={option.value}
                className="flex items-start gap-3 rounded-md border border-brand-border bg-brand-bg px-3 py-2.5 text-sm hover:bg-brand-surface-hover has-[:checked]:border-brand-primary has-[:checked]:ring-1 has-[:checked]:ring-brand-primary"
              >
                <input
                  type="radio"
                  name="cancel-reason"
                  value={option.value}
                  checked={cancelReason === option.value}
                  onChange={() => {
                    setCancelReason(option.value)
                    setSurveyError('')
                  }}
                  className="mt-0.5 h-4 w-4 text-brand-primary accent-brand-primary"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>

          {cancelReason === 'other' && (
            <div className="mt-3">
              <label htmlFor="cancel-survey-other" className="mb-1.5 block text-sm font-medium text-brand-text">
                Please tell us more
              </label>
              <Textarea
                id="cancel-survey-other"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="What makes you want to switch?"
                className="min-h-[70px]"
              />
            </div>
          )}

          <div className="mt-4">
            <label htmlFor="cancel-survey-feedback" className="mb-1.5 block text-sm font-medium text-brand-text">
              Anything we could do better? <span className="font-normal text-brand-text-muted">(optional)</span>
            </label>
            <Textarea
              id="cancel-survey-feedback"
              value={cancelFeedback}
              onChange={(e) => setCancelFeedback(e.target.value)}
              placeholder={'Your feedback helps us improve\u2026'}
              className="min-h-[70px]"
            />
          </div>

          {surveyError && (
            <p role="alert" className="mt-3 flex items-center gap-1.5 text-sm text-[var(--color-error)]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {surveyError}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={closeCancelSurvey} disabled={actionLoading === 'cancel'}>
              Keep My Plan
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={actionLoading === 'cancel'}
              className="gap-2"
            >
              {actionLoading === 'cancel' && <Loader2 className="h-4 w-4 animate-spin" />}
              Cancel Subscription
            </Button>
          </div>
        </Modal>

    </DashboardLayout>
  )
}
