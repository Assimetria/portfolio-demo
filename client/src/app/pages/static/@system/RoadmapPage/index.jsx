// @system — Public roadmap page: In Progress / Planned / Considering columns
import { Header } from '../../../../components/@system/Header'
import { Footer } from '../../../../components/@system/Footer'
import { info } from '@/config'

const COLUMNS = [
  {
    label: 'In Progress',
    color: 'border-[var(--color-info)]',
    badge: 'text-[var(--color-info)] bg-[var(--color-info-bg)] dark:text-[var(--color-info)] dark:bg-[var(--color-info-bg)]/40',
    items: [
      {
        title: 'Core feature set',
        desc: `Building out the essential features that make ${info.name} great for everyday use.`,
      },
      {
        title: 'Performance improvements',
        desc: 'Optimizing load times, reducing bundle size, and improving responsiveness across all devices.',
      },
      {
        title: 'API v1 stabilization',
        desc: 'Finalizing the public API with comprehensive documentation and client SDKs.',
      },
    ],
  },
  {
    label: 'Planned',
    color: 'border-violet-400',
    badge: 'text-violet-700 bg-violet-50 dark:text-violet-300 dark:bg-violet-900/40',
    items: [
      {
        title: 'Team collaboration',
        desc: 'Invite team members, assign roles, and collaborate in real time.',
      },
      {
        title: 'Advanced analytics',
        desc: 'Deeper insights with cohort tracking, funnel analysis, and exportable reports.',
      },
      {
        title: 'Integrations marketplace',
        desc: 'Connect with the tools you already use through a growing library of integrations.',
      },
    ],
  },
  {
    label: 'Considering',
    color: 'border-gray-300 dark:border-gray-600',
    badge: 'text-gray-600 bg-gray-100 dark:text-brand-text-secondary dark:bg-gray-800',
    items: [
      {
        title: 'Mobile app',
        desc: `A native mobile experience for ${info.name} on iOS and Android.`,
      },
      {
        title: 'White-label support',
        desc: 'Let agencies and resellers embed a branded dashboard for their clients.',
      },
      {
        title: 'Workflow automation',
        desc: 'Visual builder for common automation sequences without writing code.',
      },
    ],
  },
]

export function RoadmapPage() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />

      <main id="main-content" className="container mx-auto px-4 py-16 max-w-5xl">
        <div className="mb-12 max-w-2xl">
          <h1 className="text-4xl font-bold mb-3">Roadmap</h1>
          <p className="text-lg text-brand-text-muted">
            What we're building next for {info.name}. We ship regularly — check the{' '}
            <a href="/changelog" className="text-brand-primary hover:underline underline-offset-4">
              changelog
            </a>{' '}
            for what's already live.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.label} className={`rounded-lg border-t-4 ${col.color} border border-t-[4px] bg-brand-surface`}>
              <div className="px-4 py-3 border-b">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${col.badge}`}>
                  {col.label}
                </span>
              </div>
              <div className="divide-y">
                {col.items.map((item) => (
                  <div key={item.title} className="px-4 py-4">
                    <h3 className="text-sm font-semibold mb-1">{item.title}</h3>
                    <p className="text-xs text-brand-text-muted leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-lg border bg-brand-surface p-6 text-center">
          <p className="text-sm text-brand-text-muted mb-2">
            Have a feature request? We'd love to hear it.
          </p>
          <a
            href={`mailto:${info.supportEmail}`}
            className="text-brand-primary text-sm font-medium hover:underline underline-offset-4"
          >
            Send us your idea →
          </a>
        </div>
      </main>

      <Footer />
    </div>
  )
}
