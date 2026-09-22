// @system — public careers page: open positions and company culture
import { Link } from 'react-router-dom'
import { Briefcase, ArrowRight, MapPin, Clock } from 'lucide-react'
import { Header } from '../../../../components/@system/Header'
import { Footer } from '../../../../components/@system/Footer'
import { Card, CardContent } from '../../../../components/@system/Card'
import { Button } from '../../../../components/@system/ui/button'
import { info } from '@/config'

// ── Page ───────────────────────────────────────────────────────────────────────

export function CareersPage() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="bg-brand-surface/40 border-b">
        <div className="container mx-auto px-4 py-20 text-center max-w-3xl">
          <div className="flex justify-center mb-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10">
              <Briefcase className="h-7 w-7 text-brand-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4">Careers at {info.name}</h1>
          <p className="text-lg text-brand-text-muted leading-relaxed">
            We're building something meaningful. If you're passionate about great software and
            want to work with a small, focused team, we'd love to hear from you.
          </p>
        </div>
      </section>

      {/* ── No open positions ─────────────────────────────────────────────── */}
      <section className="container mx-auto px-4 py-16 max-w-3xl">
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-surface">
                <Briefcase className="h-6 w-6 text-brand-text-muted" />
              </div>
            </div>
            <h2 className="text-xl font-semibold mb-2">No open positions right now</h2>
            <p className="text-brand-text-muted max-w-md mx-auto mb-6">
              We don't have any open roles at the moment, but we're always interested in
              hearing from talented people. Send us your details and we'll reach out when
              something opens up.
            </p>
            <Button asChild>
              <a href={`mailto:${info.supportEmail}?subject=Career Inquiry`}>
                Get in touch <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* ── Why join us ───────────────────────────────────────────────────── */}
      <section className="bg-brand-surface border-y">
        <div className="container mx-auto px-4 py-16 max-w-3xl">
          <h2 className="text-2xl font-bold mb-8 text-center">Why work with us</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              { icon: MapPin, title: 'Remote-friendly', description: 'Work from anywhere. We believe great work happens when you choose your environment.' },
              { icon: Clock, title: 'Flexible hours', description: 'We focus on outcomes, not hours logged. Structure your day around your best work.' },
              { icon: Briefcase, title: 'Meaningful work', description: 'Every contribution has a direct impact on the product and the people who use it.' },
              { icon: ArrowRight, title: 'Growth', description: 'Small team means big opportunities. Take on new challenges and grow your skills fast.' },
            ].map(({ icon: Icon, title, description }) => (
              <Card key={title}>
                <CardContent className="pt-6 pb-6 flex gap-4">
                  <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10">
                    <Icon className="h-5 w-5 text-brand-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{title}</h3>
                    <p className="text-sm text-brand-text-muted leading-relaxed">{description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="container mx-auto px-4 py-20 max-w-2xl text-center">
        <h2 className="text-2xl font-bold mb-4">Want to learn more?</h2>
        <p className="text-brand-text-muted mb-8">
          Learn about our mission, values, and the team behind {info.name}.
        </p>
        <Button asChild variant="outline" size="lg">
          <Link to="/about">
            About us <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </section>

      <Footer />
    </div>
  )
}
