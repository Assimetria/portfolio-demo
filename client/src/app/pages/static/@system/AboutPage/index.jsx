// @system — public about page: mission, team, and company story
import { Link } from 'react-router-dom'
import { Users, Target, Lightbulb, ArrowRight, Heart } from 'lucide-react'
import { Header } from '../../../../components/@system/Header'
import { Footer } from '../../../../components/@system/Footer'
import { Card, CardContent } from '../../../../components/@system/Card'
import { Button } from '../../../../components/@system/ui/button'
import { info } from '@/config'

// ── Data — replace with your own content ─────────────────────────────────────

const VALUES = [
  {
    icon: Target,
    title: 'Mission-driven',
    description:
      'Everything we build is in service of a clear mission. We stay focused on what matters most to our users.' },
  {
    icon: Lightbulb,
    title: 'Always learning',
    description:
      'We embrace curiosity, share knowledge openly, and continuously improve our craft.' },
  {
    icon: Users,
    title: 'User-first',
    description:
      'We listen deeply, iterate quickly, and measure success by the outcomes we create for the people who use our product.' },
  {
    icon: Heart,
    title: 'Built together',
    description:
      'Great things happen when talented people collaborate without ego. We hire for character as much as skill.' },
]

// ── Page ───────────────────────────────────────────────────────────────────────

export function AboutPage() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="bg-brand-surface/40 border-b">
        <div className="container mx-auto px-4 py-20 text-center max-w-3xl">
          <div className="flex justify-center mb-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10">
              <Users className="h-7 w-7 text-brand-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4">About {info.name}</h1>
          <p className="text-lg text-brand-text-muted leading-relaxed">
            {info.tagline?.replace(/\.$/, '')}. We're a small team obsessed with building software that makes people's
            lives meaningfully better.
          </p>
        </div>
      </section>

      {/* ── Story ─────────────────────────────────────────────────────────── */}
      <section className="container mx-auto px-4 py-16 max-w-3xl">
        <h2 className="text-2xl font-bold mb-6">Our story</h2>
        <div className="space-y-4 text-brand-text-muted leading-relaxed">
          <p>
            {info.name} was founded with a simple belief: the best tools get out of your way and let
            you do your best work. We've seen too many products that add complexity instead of
            removing it, and we set out to do better.
          </p>
          <p>
            We started with a small team and a single problem worth solving. Every decision since
            has been guided by what genuinely helps our users — not what looks impressive on a
            feature list.
          </p>
          <p>
            Today we serve thousands of users around the world. We're proud of what we've built and
            even more excited about where we're going.
          </p>
        </div>
      </section>

      {/* ── Values ────────────────────────────────────────────────────────── */}
      <section className="bg-brand-surface border-y">
        <div className="container mx-auto px-4 py-16 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold mb-3">What we believe in</h2>
            <p className="text-brand-text-muted">
              These values guide every product decision, every hire, and every customer interaction.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {VALUES.map(({ icon: Icon, title, description }) => (
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
        <h2 className="text-2xl font-bold mb-4">Ready to get started?</h2>
        <p className="text-brand-text-muted mb-8">
          Join thousands of users who rely on {info.name} every day.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth?tab=register">
              Get started free <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href={`mailto:${info.supportEmail}`}>Contact us</a>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  )
}
