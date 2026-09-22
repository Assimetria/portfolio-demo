// @system — shared UI primitives, helpers, and constants for AdminPage tabs
import { Card, CardContent } from '../../../../components/@system/Card'

export const PAGE_SIZE = 20

// formatDate lives in ./format.js (plain helper, kept out of this component module
// so React Fast Refresh can hot-swap the parts below).

// ── Toggle switch ────────────────────────────────────────────────────────────
export function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 ${
        checked ? 'bg-brand-primary' : 'bg-brand-surface'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-brand-bg shadow-sm transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

// ── Stat card ────────────────────────────────────────────────────────────────
export function StatCard({ icon: Icon, label, value, loading }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-brand-text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold">
              {loading ? <span className="inline-block h-7 w-16 animate-pulse rounded bg-brand-surface" /> : value}
            </p>
          </div>
          <div className="rounded-full bg-brand-primary/10 p-3">
            <Icon className="h-5 w-5 text-brand-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Status badge ─────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  active:    'bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)]/30 dark:text-[var(--color-success)]',
  trialing:  'bg-[var(--color-info-bg)] text-[var(--color-info)] dark:bg-[var(--color-info-bg)]/30 dark:text-[var(--color-info)]',
  canceled:  'bg-[var(--color-error-bg)] text-[var(--color-error)] dark:bg-[var(--color-error-bg)]/30 dark:text-[var(--color-error)]',
  cancelled: 'bg-[var(--color-error-bg)] text-[var(--color-error)] dark:bg-[var(--color-error-bg)]/30 dark:text-[var(--color-error)]',
  past_due:  'bg-[var(--color-warning-bg)] text-[var(--color-warning)] dark:bg-[var(--color-warning-bg)]/30 dark:text-[var(--color-warning)]',
}

export function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] ?? 'bg-brand-surface text-brand-text-muted'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status ?? '—'}
    </span>
  )
}

// ── Settings section ─────────────────────────────────────────────────────────
export function SettingsSection({ title, icon: Icon, children }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-1 border-b">
        <Icon className="h-4 w-4 text-brand-text-muted" />
        <h3 className="text-sm font-semibold text-brand-text-muted uppercase tracking-wider">{title}</h3>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

export function SettingsRow({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between rounded-lg px-1 py-3 hover:bg-brand-surface-hover/30 transition-colors">
      <div>
        <p className="font-medium text-sm">{label}</p>
        {description && <p className="text-xs text-brand-text-muted mt-0.5">{description}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}
