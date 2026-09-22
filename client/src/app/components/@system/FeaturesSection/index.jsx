// @system — Landing page features section: numbered feature cards (01–04) with embedded visuals
// Design reference: unosend.co — 2x2 feature grid with mockup visuals inside each card
// @custom — to customise, pass `features` prop or import and wrap with your own data
import { Zap, Shield, BarChart3, CreditCard } from 'lucide-react'

// ── Embedded visual mockups (like unosend's progress bars, code snippets, dashboards) ──

function DeliveryMetrics() {
  return (
    <div className="mt-5 space-y-3">
      {[
        { label: 'API response time', value: '98.2%', pct: 98 },
        { label: 'Error rate', value: '0.3%', pct: 3 },
        { label: 'Cache hit rate', value: '94.1%', pct: 94 },
      ].map(({ label, value, pct }) => (
        <div key={label}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-brand-text-muted">{label}</span>
            <span className="font-medium text-brand-text">{value}</span>
          </div>
          <div className="h-1.5 rounded-full bg-brand-primary/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ))}
      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[var(--brand-border-subtle)]/50">
        {[
          { val: '4 Regions', sub: 'Multi-cloud' },
          { val: '12 Nodes', sub: 'Auto-scaling' },
          { val: '<200ms', sub: 'P99 latency' },
        ].map(({ val, sub }) => (
          <div key={val} className="text-center">
            <div className="text-xs font-semibold text-brand-text">{val}</div>
            <div className="text-[10px] text-brand-text-muted">{sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DashboardMockup() {
  return (
    <div className="mt-5 rounded-lg border border-[var(--brand-border-subtle)]/50 bg-[var(--brand-bg)]/50 overflow-hidden">
      <div className="flex border-b border-[var(--brand-border-subtle)]/50 text-[10px]">
        {['Overview', 'Users', 'Billing', 'API Keys'].map((tab, i) => (
          <span
            key={tab}
            className={`px-3 py-2 ${i === 0 ? 'text-brand-text font-medium border-b border-primary' : 'text-brand-text-muted'}`}
          >
            {tab}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-px bg-border/30">
        {[
          { label: 'Users', value: '2,489', change: '+12%' },
          { label: 'Revenue', value: '$8.4k', change: '+23%' },
          { label: 'API calls', value: '142k', change: '+8%' },
          { label: 'Active', value: '1,891', change: '+5%' },
        ].map(({ label, value, change }) => (
          <div key={label} className="bg-[var(--brand-bg)]/50 px-2.5 py-2.5">
            <div className="text-[10px] text-brand-text-muted">{label}</div>
            <div className="text-sm font-semibold text-brand-text">{value}</div>
            <div className="text-[10px] text-emerald-500">{change}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CodeSnippet() {
  return (
    <div className="mt-5">
      <div className="rounded-lg border border-[var(--brand-border-subtle)]/50 bg-brand-surface p-4 font-mono text-[11px] leading-relaxed overflow-hidden">
        <div><span className="text-[var(--color-info)] dark:text-[var(--color-info)]">import</span> <span className="text-emerald-600 dark:text-emerald-400">{'{ createClient }'}</span> <span className="text-[var(--color-info)] dark:text-[var(--color-info)]">from</span> <span className="text-[var(--color-warning)] dark:text-[var(--color-warning)]">&apos;your-product/sdk&apos;</span></div>
        <div className="mt-2"><span className="text-purple-600 dark:text-purple-400">const</span> <span className="text-[var(--color-info)] dark:text-[var(--color-info)]">client</span> = <span className="text-emerald-600 dark:text-emerald-400">createClient</span>({'{'}</div>
        <div className="pl-4"><span className="text-[var(--color-info)] dark:text-[var(--color-info)]">apiKey</span>: <span className="text-[var(--color-warning)] dark:text-[var(--color-warning)]">&apos;sk_live_...&apos;</span></div>
        <div>{'}'})</div>
        <div className="mt-2"><span className="text-purple-600 dark:text-purple-400">const</span> <span className="text-[var(--color-info)] dark:text-[var(--color-info)]">user</span> = <span className="text-[var(--color-info)] dark:text-[var(--color-info)]">await</span> client.<span className="text-emerald-600 dark:text-emerald-400">users</span>.<span className="text-emerald-600 dark:text-emerald-400">create</span>({'{'}</div>
        <div className="pl-4"><span className="text-[var(--color-info)] dark:text-[var(--color-info)]">email</span>: <span className="text-[var(--color-warning)] dark:text-[var(--color-warning)]">&apos;dev@example.com&apos;</span>,</div>
        <div className="pl-4"><span className="text-[var(--color-info)] dark:text-[var(--color-info)]">plan</span>: <span className="text-[var(--color-warning)] dark:text-[var(--color-warning)]">&apos;pro&apos;</span></div>
        <div>{'}'})</div>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {['REST API', 'Node.js', 'Python', 'Go', 'Ruby'].map((lang) => (
          <span key={lang} className="rounded-full border border-[var(--brand-border-subtle)]/50 bg-brand-surface px-2 py-0.5 text-[10px] text-brand-text-muted">
            {lang}
          </span>
        ))}
      </div>
    </div>
  )
}

function EventFeed() {
  const events = [
    { time: 'now', label: 'User signed up', status: 'success' },
    { time: '2s ago', label: 'Payment processed', status: 'success' },
    { time: '5s ago', label: 'API key created', status: 'success' },
    { time: '12s ago', label: 'Team invite sent', status: 'info' },
    { time: '18s ago', label: 'Webhook delivered', status: 'success' },
  ]
  return (
    <div className="mt-5 space-y-2">
      {events.map(({ time, label, status }, i) => (
        <div key={i} className="flex items-center gap-2.5 text-xs">
          <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
            i === 0 ? 'bg-emerald-500 animate-pulse' :
            status === 'success' ? 'bg-emerald-500/60' : 'bg-[var(--color-info)]/60'
          }`} />
          <span className="text-brand-text-muted w-12 flex-shrink-0 font-mono text-[10px]">{time}</span>
          <span className="text-brand-text truncate">{label}</span>
        </div>
      ))}
      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[var(--brand-border-subtle)]/50 mt-3">
        {[
          { val: '99.9%', sub: 'Uptime' },
          { val: '<30ms', sub: 'Response' },
          { val: '24/7', sub: 'Monitoring' },
        ].map(({ val, sub }) => (
          <div key={val} className="text-center">
            <div className="text-xs font-semibold text-brand-text">{val}</div>
            <div className="text-[10px] text-brand-text-muted">{sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

const VISUAL_MAP = {
  metrics: DeliveryMetrics,
  dashboard: DashboardMockup,
  code: CodeSnippet,
  events: EventFeed,
}

const DEFAULT_FEATURES = [
  {
    icon: Zap,
    title: 'Fast by Default',
    description:
      'Webpack 5 + React 18 with code-splitting, lazy loading, and optimised builds. Under 200ms P99 latency.',
    visual: 'metrics',
  },
  {
    icon: Shield,
    title: 'One Dashboard, Not Ten',
    description:
      'Users, billing, teams, and API keys in a single admin panel. Real-time metrics across every service.',
    visual: 'dashboard',
  },
  {
    icon: BarChart3,
    title: 'Ship in Minutes, Not Days',
    description:
      'Full SDK with typed client, auth helpers, and webhook handlers. First integration in under five minutes.',
    visual: 'code',
  },
  {
    icon: CreditCard,
    title: 'Know What Happens',
    description:
      'Live event feed, real-time cost tracking, and automated alerts. Never miss a signup, payment, or error.',
    visual: 'events',
  },
]

export function FeaturesSection({
  features = DEFAULT_FEATURES,
  heading = 'Everything you need to ship',
  subheading = 'A production-ready template so you can focus on your product, not your infrastructure.',
}) {
  return (
    <section id="features" className="container mx-auto px-4 py-16 sm:py-20 md:py-24">
      <div className="text-center mb-10 sm:mb-14">
        <p className="text-xs font-medium uppercase tracking-widest text-brand-text-muted mb-3">
          Features
        </p>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
          {heading}
        </h2>
        <p className="mt-3 text-sm sm:text-base text-brand-text-muted max-w-xl mx-auto leading-relaxed">
          {subheading}
        </p>
      </div>

      <div className="grid gap-5 sm:gap-6 grid-cols-1 md:grid-cols-2 max-w-5xl mx-auto">
        {features.map(({ icon: Icon, title, description, visual }, index) => {
          const VisualComponent = visual ? VISUAL_MAP[visual] : null
          return (
            <div
              key={title}
              className="group relative rounded-xl border border-[var(--brand-border-subtle)] bg-brand-surface p-5 sm:p-7 transition-all hover:shadow-md hover:border-primary/20"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/10">
                  <Icon className="h-4 w-4 text-brand-primary" />
                </div>
                <span className="text-xs font-mono font-medium text-[var(--brand-text-muted)] tracking-widest uppercase">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>

              <h3 className="font-semibold text-lg mt-3 mb-2">{title}</h3>
              <p className="text-sm text-brand-text-muted leading-relaxed">
                {description}
              </p>

              {VisualComponent && <VisualComponent />}
            </div>
          )
        })}
      </div>
    </section>
  )
}
