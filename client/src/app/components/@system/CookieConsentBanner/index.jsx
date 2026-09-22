// @system — GDPR-compliant cookie consent banner
// Shown once to new visitors; stores preference in localStorage.
// Accepts: essential only, or all cookies. Preference persists for 1 year.
// Also logs the consent choice server-side via POST /api/gdpr/consent (Art. 7).
// @custom — override CONSENT_KEY if the product slug needs a unique key.

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Cookie, X, Check } from 'lucide-react'
import { cn } from '@/app/lib/@system/utils'

const CONSENT_KEY = 'cookie_consent'
const CONSENT_TTL_MS = 365 * 24 * 60 * 60 * 1000 // 1 year

function loadConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !parsed.ts) return null
    if (Date.now() - parsed.ts > CONSENT_TTL_MS) {
      localStorage.removeItem(CONSENT_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function saveConsent(value) {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ value, ts: Date.now() }))
  } catch {}
}

// Fire-and-forget: log consent to server for GDPR Art. 7 audit trail.
// Failures are silently swallowed — client-side consent is already saved.
function logConsentToServer(value) {
  try {
    const IS_TUNNEL = !window.location.origin.includes('localhost')
    const API_BASE = IS_TUNNEL ? `${window.location.origin}/api` : '/api'
    fetch(`${API_BASE}/gdpr/consent`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consent_value: value }),
    }).catch(() => {})
  } catch {}
}

/**
 * CookieConsentBanner
 *
 * Renders a fixed bottom banner until the user makes a choice.
 * After accepting/rejecting, the banner disappears and the choice is persisted.
 *
 * Usage: mount once at the app root (App.jsx). No props required.
 *
 * @param {Object} props
 * @param {string} [props.className] - Additional CSS classes for the banner
 */
export function CookieConsentBanner({ className }) {
  const [consent, setConsent] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = loadConsent()
    if (stored) {
      setConsent(stored.value)
      setVisible(false)
    } else if (document.getElementById('cc-banner')) {
      // Static cookie-consent.js banner already in the DOM — defer to it to avoid
      // showing a duplicate. React will re-render on the next page load using
      // localStorage (which cookie-consent.js writes on accept/reject).
      setVisible(false)
    } else {
      // Small delay so the banner doesn't flash during initial render
      const t = setTimeout(() => setVisible(true), 600)
      return () => clearTimeout(t)
    }
  }, [])

  if (!visible || consent !== null) return null

  const handleAcceptAll = () => {
    saveConsent('all')
    logConsentToServer('all')
    setConsent('all')
    setVisible(false)
  }

  const handleEssentialOnly = () => {
    saveConsent('essential')
    logConsentToServer('essential')
    setConsent('essential')
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className={cn(
        'fixed bottom-0 inset-x-0 z-50',
        'border-t border-[var(--brand-border-subtle)] bg-[var(--brand-bg)] backdrop-blur-sm shadow-lg',
        'animate-in slide-in-from-bottom-4 duration-300',
        className
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Icon + text */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Cookie className="h-5 w-5 text-brand-primary shrink-0 mt-0.5" />
          <p className="text-sm text-brand-text-muted leading-relaxed">
            We use cookies to improve your experience and analyse site usage. Essential cookies are
            always active.{' '}
            <Link
              to="/cookies"
              className="text-brand-primary underline underline-offset-2 hover:opacity-80 transition-opacity whitespace-nowrap"
            >
              Cookie Policy
            </Link>
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={handleEssentialOnly}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium',
              'border border-[var(--brand-border-subtle)] text-brand-text',
              'hover:bg-brand-surface-hover transition-colors'
            )}
          >
            <X className="h-3.5 w-3.5" />
            Essential only
          </button>
          <button
            onClick={handleAcceptAll}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium',
              'bg-brand-primary text-brand-text-on-primary',
              'hover:opacity-90 transition-opacity'
            )}
          >
            <Check className="h-3.5 w-3.5" />
            Accept all
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * useCookieConsent — hook to read the current consent value from localStorage.
 *
 * @returns {{ consent: 'all' | 'essential' | null }}
 *   null  = no decision yet (banner not yet dismissed)
 *   'essential' = user accepted essential cookies only
 *   'all' = user accepted all cookies
 */
export function useCookieConsent() {
  const [consent, setConsent] = useState(() => {
    const stored = loadConsent()
    return stored ? stored.value : null
  })

  useEffect(() => {
    // Re-read when storage changes (e.g. user opens second tab)
    function onStorage(e) {
      if (e.key === CONSENT_KEY) {
        const stored = loadConsent()
        setConsent(stored ? stored.value : null)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return { consent }
}
