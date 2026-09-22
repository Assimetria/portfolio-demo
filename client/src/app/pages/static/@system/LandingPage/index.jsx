// @system — Landing page: hero + logos + numbered features + stats + testimonials + pricing + FAQ + CTA + footer
// Design reference: unosend.co — polished, modern SaaS landing page
// @custom — to add custom sections, create @custom/LandingPage.jsx that wraps or extends this
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Plus, Minus } from 'lucide-react'
import { Button } from '../../../../components/@system/ui/button'
import { LandingNavbar } from '../../../../components/@system/LandingNavbar'
import { Footer } from '../../../../components/@system/Footer'
import { Card, CardContent } from '../../../../components/@system/Card'
import { FeaturesSection } from '../../../../components/@system/FeaturesSection'
import { OgMeta } from '../../../../components/@system/OgMeta'
import { info, text } from '@/config'
import { useContent } from '../../../../hooks/@system/useContent'
import { copyText } from '../../../../lib/@system/content'

// @custom — override ALL data constants below via @custom/text/index.js (landing.*)
// Fallbacks are template defaults — products set their own copy in @custom.

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

const DEFAULT_TESTIMONIALS = [
  {
    text: 'We had auth, billing, and teams running in one afternoon. Three months later we had paying customers.',
    author: 'James R.',
    role: 'Founder, Launchpad.io',
    initials: 'JR',
  },
  {
    text: 'We saved six weeks of setup time and went straight to building our core feature. The Stripe integration alone is worth it.',
    author: 'Anika M.',
    role: 'CTO, Northforge',
    initials: 'AM',
  },
  {
    text: 'The multi-tenant teams code is exactly what I needed and would have taken me weeks to get right. Now it just works.',
    author: 'Paulo L.',
    role: 'Solo founder, Shipkit',
    initials: 'PL',
  },
]

const DEFAULT_FAQ = [
  {
    q: 'What tech stack does this use?',
    a: 'Node.js + Express backend, React + Vite frontend, PostgreSQL database, and Docker for deployment. Deploys to Railway with one click.',
  },
  {
    q: 'Can I use this for client projects?',
    a: 'Yes. The Pro plan allows unlimited projects. The Enterprise plan includes a white-label licence for agency use.',
  },
  {
    q: 'Do I get future updates?',
    a: 'Pro and Enterprise plans include all future updates at no extra cost. You get notified when a new version drops.',
  },
  {
    q: 'What payment providers are supported?',
    a: 'Stripe is wired by default with subscriptions, usage billing, and customer portal. The billing layer is abstracted so you can swap providers with minimal effort.',
  },
  {
    q: 'How is the multi-tenant model structured?',
    a: 'Each workspace is isolated at the data layer. Users can belong to multiple workspaces with different roles (owner, admin, member).',
  },
]

// Resolve from text config — @custom overrides @system
const t = text.landing ?? {}
const PLANS = t.plans?.length ? t.plans : DEFAULT_PLANS
const LOGO_COMPANIES = t.logoCompanies?.length ? t.logoCompanies : ['Acme SaaS', 'Launchpad', 'Northforge', 'Shipkit', 'Solaris', 'Keystone']
const STATS = t.stats?.length ? t.stats : [
  { value: '1,200+', label: 'Active teams' },
  { value: '<30 min', label: 'To first deploy' },
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '24/7', label: 'Support included' },
]
const TESTIMONIALS = t.testimonials?.length ? t.testimonials : DEFAULT_TESTIMONIALS
const FAQ_ITEMS = t.faq?.length ? t.faq : DEFAULT_FAQ

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-brand-border">
      <button
        className="w-full flex items-center justify-between py-5 text-left text-base font-semibold text-brand-text hover:text-brand-primary transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {q}
        {open ? (
          <Minus className="h-4 w-4 text-brand-primary shrink-0 ml-4" />
        ) : (
          <Plus className="h-4 w-4 text-brand-text-muted shrink-0 ml-4" />
        )}
      </button>
      {open && (
        <p className="pb-5 text-sm text-brand-text-muted leading-relaxed">{a}</p>
      )}
    </div>
  )
}

export function LandingPage() {
  // Hero copy precedence per field: config text.landing.hero (highest) →
  // content/@custom/landing.js → content/@system/landing.js → literal.
  const content = useContent('landing')
  const heroTitle = t.hero?.title ?? copyText(content, 'heroTitle', info.tagline)
  const heroSubtitle =
    t.hero?.subtitle ??
    copyText(
      content,
      'heroSubtitle',
      `${info.name} gives you everything you need to build, launch, and scale your product. Get started in minutes, not months.`,
    )
  const heroCta = t.hero?.cta ?? copyText(content, 'ctaButton', 'Get Started Free')
  const heroCtaSecondary = t.hero?.ctaSecondary ?? copyText(content, 'ctaSecondary', 'View Pricing')

  return (
    <div className="min-h-screen bg-brand-bg">
      <OgMeta
        title={info.name}
        description={info.tagline}
        url={info.url}
      />
      <LandingNavbar />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-transparent pointer-events-none" />
        <div className="container mx-auto px-4 py-16 sm:py-20 md:py-28 text-center relative">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-brand-primary/5 px-3.5 py-1.5 text-xs font-medium text-brand-primary mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Now available
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
            {heroTitle}
          </h1>
          <p className="mt-4 sm:mt-6 text-base sm:text-lg text-brand-text-muted max-w-2xl mx-auto leading-relaxed">
            {heroSubtitle}
          </p>
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 max-w-xs sm:max-w-none mx-auto">
            <Button asChild size="lg" className="gap-2 w-full sm:w-auto sm:min-w-[180px]">
              <Link to="/auth?tab=register">
                {heroCta} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto sm:min-w-[180px]">
              <Link to={t.hero?.ctaSecondaryLink ?? '/#pricing'}>
                {heroCtaSecondary}
              </Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-brand-text-muted">No credit card required</p>
        </div>
      </section>

      {/* ── Social proof logos ─────────────────────────────────────────── */}
      <section className="border-t border-brand-border/50 py-10 sm:py-12">
        <div className="container mx-auto px-4">
          <p className="text-center text-xs font-medium uppercase tracking-widest text-brand-text-muted/60 mb-6 sm:mb-8">
            Trusted by teams at
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-x-12">
            {LOGO_COMPANIES.map((name) => (
              <span
                key={name}
                className="text-sm sm:text-base font-bold text-brand-text-muted/40 hover:text-brand-text-muted/70 transition-colors tracking-tight"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <FeaturesSection />

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <section className="bg-brand-primary text-brand-text-on-primary py-14 sm:py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 text-center">
            {STATS.map(({ value, label }) => (
              <div key={label}>
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold">{value}</div>
                <div className="mt-1 text-sm text-brand-text-on-primary/65">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10 sm:mb-14">
            <p className="text-xs font-medium uppercase tracking-widest text-brand-text-muted/60 mb-3">
              Testimonials
            </p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
              What teams are saying
            </h2>
            <p className="mt-3 text-sm sm:text-base text-brand-text-muted max-w-xl mx-auto">
              Real feedback from builders who shipped faster.
            </p>
          </div>
          <div className="grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-3 max-w-5xl mx-auto">
            {TESTIMONIALS.map(({ text, author, role, initials }) => (
              <div
                key={author}
                className="rounded-xl border border-brand-border bg-brand-surface p-6 flex flex-col"
              >
                <div className="text-[var(--color-warning)] text-sm mb-4 tracking-wide">★★★★★</div>
                <p className="text-sm text-brand-text-muted leading-relaxed italic flex-1">
                  &ldquo;{text}&rdquo;
                </p>
                <div className="mt-5 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary/10 text-xs font-semibold text-brand-primary">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{author}</p>
                    <p className="text-xs text-brand-text-muted">{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="bg-brand-surface py-16 sm:py-20 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10 sm:mb-14">
            <p className="text-xs font-medium uppercase tracking-widest text-brand-text-muted/60 mb-3">
              Pricing
            </p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
              Simple, transparent pricing
            </h2>
            <p className="mt-3 text-sm sm:text-base text-brand-text-muted max-w-2xl mx-auto">
              No hidden fees. No surprise charges. Cancel anytime.
            </p>
          </div>

          <div className="grid gap-6 sm:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {PLANS.map((plan) => (
              <Card
                key={plan.name}
                className={`relative ${plan.highlighted ? 'border-primary shadow-lg ring-1 ring-primary/20' : 'border-brand-border'}`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-block rounded-full bg-brand-primary px-3 py-1 text-xs font-medium text-brand-text-on-primary">
                      Most Popular
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

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10 sm:mb-14">
            <p className="text-xs font-medium uppercase tracking-widest text-brand-text-muted/60 mb-3">
              FAQ
            </p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
              Common questions
            </h2>
            <p className="mt-3 text-sm sm:text-base text-brand-text-muted max-w-xl mx-auto">
              Everything you need to know before getting started.
            </p>
          </div>
          <div className="max-w-2xl mx-auto border-t border-brand-border">
            {FAQ_ITEMS.map(({ q, a }) => (
              <FaqItem key={q} q={q} a={a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer CTA ───────────────────────────────────────────────────── */}
      <section className="border-t bg-brand-primary/[0.02]">
        <div className="container mx-auto px-4 py-16 sm:py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Ready to get started?
          </h2>
          <p className="mt-3 text-sm sm:text-base text-brand-text-muted max-w-xl mx-auto">
            Join thousands of teams already using {info.name} to build better products.
          </p>
          <div className="mt-8 flex justify-center">
            <Button asChild size="lg" className="gap-2 w-full sm:w-auto sm:min-w-[200px]">
              <Link to="/auth?tab=register">
                Create Free Account <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-brand-text-muted">No credit card required. Free plan included.</p>
        </div>
      </section>

      <Footer />
    </div>
  )
}
