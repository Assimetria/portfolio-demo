// @system — public conversion page: built-in funnel landing page for paid/email
// campaigns. Products override copy/links below via @custom so it stays neutral
// in the template and branded downstream.
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Sparkles, ShieldCheck, Zap } from 'lucide-react'
import { Header } from '../../../../components/@system/Header'
import { Footer } from '../../../../components/@system/Footer'
import { Card, CardContent } from '../../../../components/@system/Card'
import { Button } from '../../../../components/@system/ui/button'
import { info } from '@/config'

// ── Highlights — replace with product-specific value props ───────────────────
const BENEFITS = [
  {
    icon: Zap,
    title: 'Launch fast',
    description:
      'Start with a production-ready base so you go from idea to live product in days, not months.' },
  {
    icon: ShieldCheck,
    title: 'Secure by default',
    description:
      'Auth, billing, and data handling are built in and battle-tested — no need to reinvent them.' },
  {
    icon: Sparkles,
    title: 'Built to grow',
    description:
      'Teams, permissions, webhooks, and analytics scale naturally as your product does.' },
]

// ── Page ───────────────────────────────────────────────────────────────────────

export function ConversionPage() {
  const tagline = (info.tagline || 'Your vision, shipped on a production-ready foundation').replace(/\.\s*$/, '')

  useEffect(() => {
    document.title = `Start building with ${info.name}`
  }, [])
  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />

      <main id="main-content">
        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b bg-brand-surface/40">
          {/* Decorative accent block */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-primary/10 blur-3xl"
          />
          <div className="container relative mx-auto px-4 py-20 text-center max-w-3xl">
            <div className="flex justify-center mb-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10">
                <Zap className="h-7 w-7 text-primary" />
              </div>
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
              Start building with {info.name}
            </h1>
            <p className="text-lg text-brand-text-muted leading-relaxed mb-8">
              {tagline}. Join the teams already shipping products faster with everything they need on
              day one.
            </p>
            <Button asChild size="lg">
              <Link to="/auth?tab=register">
                Get started free <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <p className="mt-4 text-sm text-brand-text-muted">
              No credit card required. Cancel anytime.
            </p>
          </div>
        </section>

        {/* ── Trust bullets ───────────────────────────────────────────────── */}
        <section aria-label="Included with every plan" className="container mx-auto px-4 py-16 max-w-5xl">
          <div className="grid gap-6 sm:grid-cols-3">
            {BENEFITS.map(({ icon: Icon, title, description }) => (
              <Card key={title}>
                <CardContent className="pt-6 pb-6 flex gap-4">
                  <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{title}</h3>
                    <p className="text-sm text-brand-text-muted leading-relaxed">{description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ── What's included ─────────────────────────────────────────────── */}
        <section className="container mx-auto px-4 pb-20 max-w-3xl">
          <h2 className="text-2xl font-bold text-center mb-8">Everything you need to get going</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              'Authentication with social login',
              'Stripe and Polar billing',
              'Team management & permissions',
              'Webhooks and integrations',
              'Docs, changelog & help center',
              'Dark-first polished UI kit',
            ].map((feature) => (
              <div key={feature} className="flex items-start gap-3 rounded-xl border bg-brand-surface p-4">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-success)]" />
                <p className="text-sm text-brand-text">{feature}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth?tab=register">
                Create your account
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/pricing">See pricing</Link>
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
