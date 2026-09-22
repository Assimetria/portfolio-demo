// @system — Privacy & Data settings panel
// GDPR Art. 15: right to access — download personal data
// GDPR Art. 17: right to erasure — delete account and all personal data

import { useState } from 'react'
import { Download, Trash2, ShieldCheck, AlertTriangle, Cookie } from 'lucide-react'
import { cn } from '@/app/lib/@system/utils'
import { getMyGdprData, deleteMyGdprData } from '@/app/api/@system'
import { useCookieConsent } from '../../CookieConsentBanner'

// ─── helpers ──────────────────────────────────────────────────────────────────

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── component ────────────────────────────────────────────────────────────────

export function PrivacySettings({ className }) {
  const { consent } = useCookieConsent()

  const [exportLoading, setExportLoading] = useState(false)
  const [exportError, setExportError] = useState(null)
  const [exportDone, setExportDone] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [deleteDone, setDeleteDone] = useState(false)

  async function handleExport() {
    setExportLoading(true)
    setExportError(null)
    setExportDone(false)
    const res = await getMyGdprData()
    setExportLoading(false)
    if (res.status !== 200 || !res.data) {
      setExportError(res.message ?? 'Failed to export data.')
      return
    }
    downloadJson(res.data, `my-data-${new Date().toISOString().slice(0, 10)}.json`)
    setExportDone(true)
  }

  async function handleDelete() {
    setDeleteLoading(true)
    setDeleteError(null)
    const res = await deleteMyGdprData()
    setDeleteLoading(false)
    if (res.status !== 200) {
      setDeleteError(res.message ?? 'Failed to delete data.')
      setDeleteConfirm(false)
      return
    }
    setDeleteDone(true)
    // Force reload so stale auth state is cleared
    setTimeout(() => {
      localStorage.clear()
      window.location.href = '/'
    }, 2500)
  }

  if (deleteDone) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/5 p-6 text-center">
          <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-[var(--color-success)]" />
          <h3 className="font-semibold text-[var(--color-success)]">Account deleted</h3>
          <p className="mt-1 text-sm text-brand-text-muted">
            Your personal data has been erased. Redirecting you to the home page…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-8', className)}>

      {/* Cookie consent status */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Cookie className="h-4 w-4 text-brand-text-muted" />
          <h3 className="text-base font-semibold">Cookie preferences</h3>
        </div>
        <div className="rounded-lg border border-[var(--brand-border-subtle)] p-4">
          <p className="text-sm text-brand-text-muted">
            Current preference:{' '}
            <span className="font-medium text-brand-text">
              {consent === 'all' ? 'All cookies accepted' : consent === 'essential' ? 'Essential cookies only' : 'No preference set'}
            </span>
          </p>
          <p className="mt-2 text-xs text-brand-text-muted">
            To change your cookie preferences, clear your browser storage or visit{' '}
            <a href="/cookies" className="text-brand-primary underline underline-offset-2 hover:opacity-80">
              Cookie Policy
            </a>
            . Your choice is stored locally on this device and will expire after one year.
          </p>
        </div>
      </section>

      {/* Download data — Art. 15 */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Download className="h-4 w-4 text-brand-text-muted" />
          <h3 className="text-base font-semibold">Download your data</h3>
        </div>
        <p className="mb-4 text-sm text-brand-text-muted">
          Request a copy of all personal data we hold about you (GDPR Art. 15). The file will be
          downloaded directly to your device as JSON.
        </p>

        {exportError && (
          <div className="mb-3 rounded-md border border-[var(--color-error)]/30 bg-[var(--color-error)]/5 px-4 py-2 text-sm text-[var(--color-error)]">
            {exportError}
          </div>
        )}
        {exportDone && (
          <div className="mb-3 rounded-md border border-[var(--color-success)]/30 bg-[var(--color-success)]/5 px-4 py-2 text-sm text-[var(--color-success)]">
            Download started — check your downloads folder.
          </div>
        )}

        <button
          onClick={handleExport}
          disabled={exportLoading}
          className={cn(
            'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
            'border border-[var(--brand-border-subtle)] text-brand-text hover:bg-brand-surface-hover transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {exportLoading ? (
            <span className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {exportLoading ? 'Exporting…' : 'Download my data'}
        </button>
      </section>

      {/* Delete data — Art. 17 */}
      <section className="rounded-lg border border-[var(--color-error)]/20 p-6">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[var(--color-error)]" />
          <h3 className="text-base font-semibold text-[var(--color-error)]">Delete your data</h3>
        </div>
        <p className="mb-4 text-sm text-brand-text-muted">
          Permanently erase all personal data linked to your account (GDPR Art. 17). This action
          cannot be undone. Your account will be anonymised and you will be signed out.
        </p>

        {deleteError && (
          <div className="mb-3 rounded-md border border-[var(--color-error)]/30 bg-[var(--color-error)]/5 px-4 py-2 text-sm text-[var(--color-error)]">
            {deleteError}
          </div>
        )}

        {!deleteConfirm ? (
          <button
            onClick={() => setDeleteConfirm(true)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
              'border border-[var(--color-error)]/40 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors'
            )}
          >
            <Trash2 className="h-4 w-4" />
            Delete my data
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-[var(--color-error)]">
              Are you sure? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
                  'bg-[var(--color-error)] text-[var(--color-error)]-foreground hover:bg-[var(--color-error)]/90 transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {deleteLoading ? (
                  <span className="h-4 w-4 rounded-full border-2 border-destructive-foreground/30 border-t-destructive-foreground animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {deleteLoading ? 'Deleting…' : 'Yes, delete everything'}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                disabled={deleteLoading}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
                  'border border-[var(--brand-border-subtle)] text-brand-text hover:bg-brand-surface-hover transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

    </div>
  )
}
