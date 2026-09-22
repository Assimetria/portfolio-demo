// @system — Reusable landing pricing section: configurable tier cards.
// Extracted from the inline pricing markup that previously lived in the
// @system LandingPage so it can be reused across landing experiences.
// @custom — pass your own `plans` (and/or heading/subtitle) to brand it to a product.
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardContent } from '../Card'
import { info } from '@/config'

// Fallback plans — used only when the consumer does not pass `plans`.
// Products supply their tiers (and CTAs) through the `plans` prop.
const DEFAULT_PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'For individuals and small projects',
    features: ['Up to 3 projects', 'Basic analytics', 'Community support', '1 GB storage'],
    cta: 'Get Started Free',
    ctaLink: '/auth?tab=register',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    description: 'For growing teams and businesses',
    features: ['Unlimited projects', 'Advanced analytics', 'Priority support', 'Custom domain', 'API access', 'Team collaboration'],
    cta: 'Start Free Trial',
    ctaLink: '/auth?tab=register&plan=pro',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large-scale deployments',
    features: ['Everything in Pro', 'SLA guarantee', 'Dedicated support', 'On-premise option', 'SSO / SAML', 'Custom integrations'],
    cta: 'Contact Sales',
    ctaLink: `mailto:${info.supportEmail}`,
    highlighted: false,
  },
]

export function PricingSection({
  plans = DEFAULT_PLANS,
  eyebrow = 'Pricing',
  heading = 'Simple, transparent pricing',
  subtitle = 'No hidden fees. No surprise charges. Cancel anytime.',
  highlightLabel = 'Most Popular',
}) {
  // Guard against an empty plans array (e.g. a product passing [] after a
  // config filter) so the section never renders a bare header with no cards.
  const tiers = Array.isArray(plans) && plans.length > 0 ? plans : DEFAULT_PLANS
  return (
    <section id="pricing" className="bg-brand-surface py-16 sm:py-20 md:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10 sm:mb-14">
          <p className="text-xs font-medium uppercase tracking-widest text-brand-text-muted/60 mb-3">
            {eyebrow}
          </p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
            {heading}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-brand-text-muted max-w-2xl mx-auto">
            {subtitle}
          </p>
        </div>

        <div className="grid gap-6 sm:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
          {tiers.map((plan) => (
            <Card
              key={plan.name}
              className={`relative ${plan.highlighted ? 'border-primary shadow-lg ring-1 ring-primary/20' : 'border-brand-border'}`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-block rounded-full bg-brand-primary px-3 py-1 text-xs font-medium text-brand-text-on-primary">
                    {highlightLabel}
                  </span>
                </div>
              )}
              <CardContent className="pt-6 px-6 pb-6 flex flex-col">
                <div>
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-brand-text-muted">{plan.description}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-bold">{plan.price}</span>
                    {plan.period && (
                      <span className="text-sm text-brand-text-muted">{plan.period}</span>
                    )}
                  </div>
                </div>
                <ul className="mt-6 space-y-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check className="h-4 w-4 text-brand-primary shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className="w-full mt-6"
                  variant={plan.highlighted ? 'default' : 'outline'}
                >
                  {plan.ctaLink.startsWith('mailto:') ? (
                    <a href={plan.ctaLink}>
                      {plan.cta}
                    </a>
                  ) : (
                    <Link to={plan.ctaLink}>
                      {plan.cta}
                    </Link>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
