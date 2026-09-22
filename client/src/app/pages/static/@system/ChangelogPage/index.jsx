// @system — public changelog page: product updates and release notes
import { Link } from 'react-router-dom'
import { Clock, ArrowRight, Sparkles, Bug, Wrench } from 'lucide-react'
import { Header } from '../../../../components/@system/Header'
import { Footer } from '../../../../components/@system/Footer'
import { Card, CardContent } from '../../../../components/@system/Card'
import { Button } from '../../../../components/@system/ui/button'
import { info } from '@/config'

// ── Data — replace with your own release entries ─────────────────────────────

const RELEASES = [
  {
    version: '1.0.0',
    date: 'Launch',
    title: 'Initial release',
    description: `${info.name} is live! Everything you need to get started.`,
    type: 'feature',
  },
]

const TYPE_ICON = {
  feature: Sparkles,
  fix: Bug,
  improvement: Wrench,
}

const TYPE_LABEL = {
  feature: 'New',
  fix: 'Fix',
  improvement: 'Improvement',
}

const TYPE_COLOR = {
  feature: 'bg-brand-primary/10 text-brand-primary',
  fix: 'bg-orange-500/10 text-orange-500',
  improvement: 'bg-[var(--color-info)]/10 text-[var(--color-info)]',
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function ChangelogPage() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="bg-brand-surface/40 border-b">
        <div className="container mx-auto px-4 py-20 text-center max-w-3xl">
          <div className="flex justify-center mb-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10">
              <Clock className="h-7 w-7 text-brand-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4">Changelog</h1>
          <p className="text-lg text-brand-text-muted leading-relaxed">
            New updates, improvements, and fixes to {info.name}.
          </p>
        </div>
      </section>

      {/* ── Releases ──────────────────────────────────────────────────────── */}
      <section className="container mx-auto px-4 py-16 max-w-3xl">
        <div className="space-y-6">
          {RELEASES.map(({ version, date, title, description, type }) => {
            const Icon = TYPE_ICON[type] ?? Sparkles
            return (
              <Card key={version}>
                <CardContent className="pt-6 pb-6">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10">
                      <Icon className="h-5 w-5 text-brand-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-sm font-medium">v{version}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLOR[type] ?? TYPE_COLOR.feature}`}>
                          {TYPE_LABEL[type] ?? 'Update'}
                        </span>
                        <span className="text-xs text-brand-text-muted">{date}</span>
                      </div>
                      <h3 className="font-semibold mb-1">{title}</h3>
                      <p className="text-sm text-brand-text-muted leading-relaxed">{description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="container mx-auto px-4 py-20 max-w-2xl text-center">
        <h2 className="text-2xl font-bold mb-4">Stay up to date</h2>
        <p className="text-brand-text-muted mb-8">
          Sign up to get notified about new features and updates.
        </p>
        <Button asChild size="lg">
          <Link to="/auth?tab=register">
            Get started <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </section>

      <Footer />
    </div>
  )
}
