// @system — public pricing page powered by live Stripe prices
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Loader2, AlertCircle, Zap, Star, Building2 } from 'lucide-react'
import { Header } from '../../../../components/@system/Header'
import { Footer } from '../../../../components/@system/Footer'
import { Button } from '../../../../components/@system/ui/button'
import { Badge } from '../../../../components/@system/Badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/@system/Card'
import { useAuthContext } from '../../../../store/@system/auth'
import { info, text } from '@/config'
import { useContent } from '../../../../hooks/@system/useContent'
import { copyText } from '../../../../lib/@system/content'
import {
  getPlans,
  createCheckoutSession,
  formatAmount,
  formatInterval } from '../../../../api/@system/stripe'

// One icon per plan tier — cycles if more plans than icons
const TIER_ICONS = [Zap, Star, Building2]

// Canonical pricing comes from brand.json `pricing.plans`, surfaced at runtime as
// info.pricing by the generated config/@custom/info.js. The /pricing page must
// render the SAME Free/Pro feature lists as the landing page regardless of what
// the billing backend returns, so brand config always wins.
const BRAND_PLANS = Array.isArray(info.pricing?.plans) ? info.pricing.plans : []

// Feature bullets per plan. Reconcile to the canonical brand config by plan name
// (case-insensitive) so live Stripe listings never drift from the brand lists.
function getPlanFeatures(plan) {
  const canonical = BRAND_PLANS.find(
    (p) => p.name && p.name.toLowerCase() === String(plan.name || '').toLowerCase()
  )
  if (canonical && Array.isArray(canonical.features) && canonical.features.length) {
    return canonical.features
  }
  // Brand-fallback cards already carry the canonical features verbatim.
  if (Array.isArray(plan.features) && plan.features.length) {
    return plan.features
  }
  const raw = plan.metadata?.features
  if (raw) return raw.split(',').map((f) => f.trim()).filter(Boolean)
  return [`${plan.name} access`, 'Email support']
}

// Map a canonical brand plan into the card shape rendered below. When the billing
// backend returns no plans (e.g. Stripe is not configured), we fall back to these so
// the Free/Pro tiers — and their exact feature bullets — are ALWAYS displayed,
// keeping /pricing identical to the landing page in every scenario.
function brandPlanToCard(p) {
  const isFree = p.plan === 'free'
  const digits = String(p.price || '0').replace(/[^0-9.]/g, '')
  return {
    priceId: `brand_${p.plan}`,
    name: p.name,
    amount: Math.round(parseFloat(digits || '0') * 100),
    currency: 'USD',
    interval: isFree ? 'forever' : (p.interval || '/month').replace('/', ''),
    intervalCount: 1,
    description: p.description || (isFree ? 'Free to play forever.' : 'Everything in Free, plus more.'),
    trialDays: undefined,
    metadata: { popular: p.popular ? 'true' : 'false' },
    features: Array.isArray(p.features) ? p.features.slice() : [],
    cta: p.cta || (isFree ? 'Start Free Trial' : 'Go Pro'),
    isBrandFallback: true,
  }
}

const BRAND_FALLBACK_PLANS = BRAND_PLANS.map(brandPlanToCard)

export function PricingPage() {
  const { isAuthenticated } = useAuthContext()
  const navigate = useNavigate()
  // Copy precedence: config text.pricing.* → content/@custom/pricing → content/@system/pricing → literal
  const content = useContent('pricing')
  const tp = text.pricing ?? {}

  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(null)

  useEffect(() => {
    getPlans()
      .then((res) => setPlans(res.plans))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load plans'))
      .finally(() => setLoading(false))
  }, [])

  // Prefer live billing plans, but always fall back to the canonical brand config
  // so the Free/Pro tiers and their exact feature bullets render even when the
  // billing backend returns nothing (Stripe not configured).
  const displayPlans = plans.length ? plans : BRAND_FALLBACK_PLANS

  async function handleSelectPlan(plan) {
    const priceId = plan.priceId
    if (plan.isBrandFallback) {
      // Brand-fallback cards have no Stripe price: route to billing or register.
      navigate(isAuthenticated ? '/app/billing' : '/auth?tab=register')
      return
    }
    if (!isAuthenticated) {
      navigate(`/auth?tab=register&next=/app/billing`)
      return
    }
    setCheckoutLoading(priceId)
    try {
      await createCheckoutSession(priceId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout')
      setCheckoutLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />

      <main id="main-content" className="mx-auto max-w-5xl px-4 py-8 sm:py-12 md:py-16 sm:px-6 lg:px-8">
        {/* ── Heading ── */}
        <div className="mb-8 sm:mb-10 md:mb-12 text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
            {tp.title ?? copyText(content, 'title', 'Simple, transparent pricing')}
          </h1>
          <p className="mt-3 sm:mt-4 text-base sm:text-lg text-brand-text-muted max-w-2xl mx-auto px-4">
            {tp.subtitle ?? copyText(content, 'subtitle', 'Choose the plan that fits your needs. Upgrade or cancel anytime.')}
          </p>
        </div>

        {/* ── Error ── */}
        {/* Only surface operational errors while live Stripe plans are shown. When the
            billing backend rejects/returns nothing (Stripe not configured) we render the
            canonical brand-config plans below, so no alarming banner is shown over them. */}
        {error && displayPlans.length > 0 && !displayPlans[0].isBrandFallback && (
          <div className="mb-8 flex items-center gap-2 rounded-lg border border-destructive/30 bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error)]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* ── Plans ── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-brand-text-muted" />
          </div>
        ) : displayPlans.length === 0 ? (
          <p
            data-testid="pricing-empty"
            className="mx-auto max-w-md rounded-lg border border-brand-border bg-brand-surface px-6 py-10 text-center text-sm text-brand-text-muted"
          >
            {copyText(content, 'noPlansBody', 'Plans are not available right now. Please check back soon.')}
          </p>
        ) : (
          <div className={`grid gap-4 sm:gap-6 ${displayPlans.length === 1 ? 'max-w-sm mx-auto' : displayPlans.length === 2 ? 'sm:grid-cols-2 max-w-2xl mx-auto' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
            {displayPlans.map((plan, i) => {
              const TierIcon = TIER_ICONS[i % TIER_ICONS.length]
              const isPopular = plan.metadata?.popular === 'true'
              const features = getPlanFeatures(plan)

              return (
                <Card
                  key={plan.priceId}
                  className={`relative flex flex-col ${isPopular ? 'border-brand-primary shadow-lg ring-1 ring-brand-primary' : ''}`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="px-2.5 sm:px-3 py-0.5 text-xs">Most Popular</Badge>
                    </div>
                  )}

                  <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6">
                    <div className="flex items-center gap-2 mb-2">
                      <TierIcon className="h-4 w-4 sm:h-5 sm:w-5 text-brand-primary" />
                      <CardTitle className="text-base sm:text-lg">{plan.name}</CardTitle>
                    </div>
                    {plan.description && (
                      <CardDescription className="text-xs sm:text-sm">{plan.description}</CardDescription>
                    )}
                    <div className="mt-3 sm:mt-4">
                      <span className="text-3xl sm:text-4xl font-bold">{formatAmount(plan.amount, plan.currency)}</span>
                      <span className="ml-1 text-brand-text-muted text-xs sm:text-sm">{formatInterval(plan.interval, plan.intervalCount)}</span>
                    </div>
                    {plan.trialDays && (
                      <p className="text-xs text-brand-text-muted mt-1 sm:mt-1.5">
                        {plan.trialDays}-day free trial — no credit card required
                      </p>
                    )}
                  </CardHeader>

                  <CardContent className="flex flex-1 flex-col px-4 sm:px-6">
                    {/* Feature list */}
                    <ul className="space-y-1.5 sm:space-y-2 mb-5 sm:mb-6 flex-1">
                      {features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-xs sm:text-sm">
                          <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-brand-primary mt-0.5 shrink-0" />
                          <span className="leading-relaxed">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      className="w-full"
                      size="default"
                      variant={isPopular ? 'default' : 'outline'}
                      onClick={() => handleSelectPlan(plan)}
                      disabled={!!checkoutLoading}
                    >
                      {checkoutLoading === plan.priceId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        plan.isBrandFallback && plan.cta
                          ? plan.cta
                          : isAuthenticated ? `Get ${plan.name}` : 'Start Free Trial'
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* ── FAQ / Footer notes ── */}
        <div className="mt-10 sm:mt-12 md:mt-16 text-center space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-brand-text-muted px-4">
          <p>All plans include a 30-day money-back guarantee.</p>
          <p>
            Payments are securely processed by Stripe. We never store your card details.
          </p>
          <p>
            Questions?{' '}
            <a href={`mailto:${info.supportEmail}`} className="underline hover:text-brand-text">
              Contact us
            </a>
          </p>
          {!isAuthenticated && (
            <p className="pt-2">
              Already have an account?{' '}
              <Link to="/auth" className="underline hover:text-brand-text font-medium">
                Sign in
              </Link>
            </p>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
