// @system — public docs landing page: redirects to help center with doc-style layout
import { Link } from 'react-router-dom'
import { Book, ArrowRight, Code, Settings, CreditCard, Shield, Zap } from 'lucide-react'
import { Header } from '../../../../components/@system/Header'
import { Footer } from '../../../../components/@system/Footer'
import { Card, CardContent } from '../../../../components/@system/Card'
import { info } from '@/config'

// ── Data — documentation categories ──────────────────────────────────────────

const DOC_SECTIONS = [
  {
    icon: Zap,
    title: 'Getting Started',
    description: 'Quick start guide, installation, and first steps.',
    href: '/help',
  },
  {
    icon: Settings,
    title: 'Account & Settings',
    description: 'Manage your profile, preferences, and team settings.',
    href: '/help',
  },
  {
    icon: CreditCard,
    title: 'Billing & Plans',
    description: 'Subscription management, invoices, and plan details.',
    href: '/help',
  },
  {
    icon: Code,
    title: 'API Reference',
    description: 'REST API documentation, authentication, and examples.',
    href: '/help',
  },
  {
    icon: Shield,
    title: 'Security',
    description: 'Best practices, two-factor auth, and data protection.',
    href: '/help',
  },
]

// ── Page ───────────────────────────────────────────────────────────────────────

export function DocsPage() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="bg-brand-surface/40 border-b">
        <div className="container mx-auto px-4 py-20 text-center max-w-3xl">
          <div className="flex justify-center mb-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10">
              <Book className="h-7 w-7 text-brand-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4">Documentation</h1>
          <p className="text-lg text-brand-text-muted leading-relaxed">
            Everything you need to get the most out of {info.name}.
          </p>
        </div>
      </section>

      {/* ── Sections grid ─────────────────────────────────────────────────── */}
      <section className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DOC_SECTIONS.map(({ icon: Icon, title, description, href }) => (
            <Link key={title} to={href} className="group">
              <Card className="h-full transition-colors hover:border-primary/30">
                <CardContent className="pt-6 pb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10 mb-3">
                    <Icon className="h-5 w-5 text-brand-primary" />
                  </div>
                  <h3 className="font-semibold mb-1 group-hover:text-brand-primary transition-colors">
                    {title}
                  </h3>
                  <p className="text-sm text-brand-text-muted leading-relaxed">{description}</p>
                  <span className="inline-flex items-center text-sm text-brand-primary mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    Read more <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  )
}
