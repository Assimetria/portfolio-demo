// @system — UpgradeModal
// In-app plan change UI. Lets a user on the free plan see what they are missing,
// compare the paid plans, and start the upgrade (checkout) flow without leaving
// the app they are already in.
//
// Built on the shared @system Modal (which wraps @system/ui/dialog) so it inherits
// the same accessible, mobile-first behaviour as every other dialog.
//
// Usage (controlled — rendered by UpgradeProvider):
//   <UpgradeModal open={open} onClose={onClose} source="Settings · Billing" />
//
// The modal is provider-free: it derives the current plan from the auth store and
// fetchs the live catalogue from GET /subscriptions/plans. A product that needs a
// bespoke catalogue can pass `plans` explicitly to skip the network call.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Sparkles, ArrowRight, Check } from 'lucide-react'
import { Modal } from '../Modal'
import { Badge } from '../Badge'
import { Button } from '../ui/button'
import { Skeleton } from '../Skeleton'
import { useAuthContext } from '@/app/store/@system/auth'
import { isFreeUser } from '@/app/lib/@system/plans'
import {
  getPlans,
  formatAmount,
  formatInterval,
  createCheckoutSession,
} from '@/app/api/@system/stripe'

// Ordered tiers used to pick the "next step up" from the free plan. Kept as
// lowercase names so it tolerates how an individual product spells its plans.
const TIER_ORDER = ['free', 'starter', 'pro', 'team', 'business', 'enterprise']

function normalize(name) {
  return String(name || 'free')
    .toLowerCase()
    .trim()
}

function tierIndex(value) {
  const idx = TIER_ORDER.indexOf(normalize(value))
  return idx === -1 ? 0 : idx
}


// Only offer plans that are a real step up from the user's current tier.
function isStrictUpgrade(candidatePlan, userPlan) {
  return tierIndex(candidatePlan?.name) > tierIndex(userPlan)
}

export function UpgradeModal({ open, onClose, plans: presetPlans, source }) {
  const { user } = useAuthContext()
  const userPlan = user?.subscription?.plan ?? user?.plan ?? 'free'
  const isFreePlan = isFreeUser(user)

  const [plans, setPlans] = useState(presetPlans || [])
  const [loading, setLoading] = useState(!presetPlans)
  const [actionLoading, setActionLoading] = useState(null)
  const [error, setError] = useState('')

  // Fresh catalogue each time the dialog opens (an explicit `plans` prop wins).
  useEffect(() => {
    if (presetPlans) {
      setPlans(presetPlans)
      setLoading(false)
      return undefined
    }
    if (!open) return undefined

    let cancelled = false
    setLoading(true)
    setError('')
    getPlans()
      .then((data) => {
        if (!cancelled) setPlans(Array.isArray(data && data.plans) ? data.plans : [])
      })
      .catch(() => {
        if (!cancelled) setError('We could not load the available plans right now. Please try again.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, presetPlans])

  const upgradeablePlans = plans
    .filter((plan) => isStrictUpgrade(plan, userPlan))
    .slice(0, 3)

  async function handleUpgrade(plan) {
    const key = plan.priceId || plan.id
    setActionLoading(key)
    setError('')
    try {
      await createCheckoutSession(plan.priceId, plan.trialDays)
      // Success: createCheckoutSession redirects the tab to Stripe (or throws)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the upgrade.')
      setActionLoading(null)
    }
  }

  const lead = isFreePlan
    ? 'You are on the free plan. Pick a plan below to unlock everything.'
    : `Manage your ${normalize(userPlan)} plan here.`

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      className="overflow-hidden"
      title="Upgrade plan"
      description={source ? `${source} · ${lead}` : lead}
    >
      <div className="mb-5 flex items-center justify-between gap-4 border-b border-[var(--brand-border-subtle)] pb-4">
        {isFreePlan ? (
          <span className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-brand-primary" />
            <Badge variant="outline">Free plan</Badge>
          </span>
        ) : (
          <Badge className="capitalize">{normalize(userPlan)} plan</Badge>
        )}
        <Sparkles className="ml-auto h-4 w-4 text-brand-text-muted" aria-hidden="true" />
      </div>
      <ModalBody
        loading={loading}
        error={error}
        plans={upgradeablePlans}
        isFreePlan={isFreePlan}
        actionLoading={actionLoading}
        onUpgrade={handleUpgrade}
      />
    </Modal>
  )
}

export default UpgradeModal


function ModalBody({
  loading,
  error,
  plans,
  isFreePlan,
  actionLoading,
  onUpgrade,
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-brand-text-muted">{error}</p>
        {isFreePlan && (
          <Button asChild variant="outline" className="w-full gap-2">
            <Link to="/app/billing">
              Open billing settings
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
    )
  }

  if (plans.length > 0) {
    return (
      <div className="space-y-3">
        {plans.map((plan) => {
          const key = plan.priceId || plan.id
          const name = plan.name || 'Paid plan'
          const perks = (plan.features || plan.highlights || []).slice(0, 3)
          return (
            <div
              key={key}
              className="relative overflow-hidden rounded-xl border border-[var(--brand-border-subtle)] bg-brand-surface p-4"
            >
              {plan.metadata && plan.metadata.popular === 'true' && (
                <div className="absolute right-3 top-3">
                  <Badge>Most popular</Badge>
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0 sm:pr-4">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h4 className="text-base font-semibold">{name}</h4>
                    {plan.amount != null && (
                      <span>
                        <span className="text-lg font-bold">
                          {formatAmount(plan.amount, plan.currency || 'usd')}
                        </span>
                        <span className="text-sm font-normal text-brand-text-muted">
                          {formatInterval(plan.interval, plan.intervalCount)}
                        </span>
                      </span>
                    )}
                  </div>
                  {perks.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {perks.map((perk, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-brand-text-muted"
                        >
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                          <span>{perk}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="shrink-0">
                  <Button onClick={() => onUpgrade(plan)} disabled={!!actionLoading}>
                    {actionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                    Upgrade to {name}
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // No catalogue returned — still offer the in-app path to change plans.
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-brand-text-muted">
        {isFreePlan
          ? 'Unlock unlimited usage, integrations and priority support with a paid plan.'
          : 'Want to compare plans or manage your seat count? Head to billing.'}
      </p>
      <Button asChild variant="outline" className="w-full gap-2">
        <Link to="/app/billing">
          View plans and billing
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  )
}
