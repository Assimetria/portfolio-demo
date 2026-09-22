// @system — SettingsPlanCard
// In-app plan change entry point for the Settings surface (/app/settings).
// When the signed-in user is on the free plan it surfaces the in-app
// UpgradeModal (same shared one the dashboard and locked-feature gates use), so
// a user can change plans without leaving the app. Paid users get a compact
// "manage billing" card instead.
//
// Consumes the auth store for the current plan and the upgradeModal store for
// the shared open action, so it must be rendered inside <AuthProvider> and
// <UpgradeProvider> (the app routes tree already satisfies both).

import { Link } from 'react-router-dom'
import { Sparkles, ArrowRight, CreditCard } from 'lucide-react'
import { useAuthContext } from '@/app/store/@system/auth'
import { useUpgradeModal } from '@/app/store/@system/upgradeModal'
import { isFreeUser } from '@/app/lib/@system/plans'
import { Button } from '../ui/button'

export function SettingsPlanCard() {
  const { user } = useAuthContext()
  const { openUpgrade } = useUpgradeModal()

  const isFreePlan = isFreeUser(user)
  const planName = user?.subscription?.plan ?? user?.plan ?? 'free'

  return (
    <div className="mb-8 flex flex-col gap-4 overflow-hidden rounded-xl border border-[var(--brand-border-subtle)] bg-brand-surface p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10">
          {isFreePlan ? (
            <Sparkles className="h-5 w-5 text-brand-primary" />
          ) : (
            <CreditCard className="h-5 w-5 text-brand-primary" />
          )}
        </div>
        <div>
          <h2 className="text-base font-semibold capitalize">
            {isFreePlan ? 'You are on the free plan' : `${planName} plan`}
          </h2>
          {isFreePlan ? (
            <p className="mt-0.5 text-sm text-brand-text-muted">
              Upgrade to unlock more seats, higher limits and priority support — no need to leave the app.
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-brand-text-muted">
              Manage your subscription, payment method and invoices anytime.
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2 lg:self-center">
        {isFreePlan ? (
          <Button
            size="sm"
            onClick={() => openUpgrade('Settings')}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Upgrade plan
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : null}
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link to="/app/billing">
            <CreditCard className="h-4 w-4" />
            Manage billing
          </Link>
        </Button>
      </div>
    </div>
  )
}

export default SettingsPlanCard
