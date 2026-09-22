// @system — Dismissible announcement banner
// Sticky top banner for product announcements, promotions, or system alerts.
// Supports variants, CTA buttons, and persistent dismiss via localStorage.

import { useState } from 'react'
import { X, ArrowRight, Megaphone, AlertTriangle, Info, Sparkles } from 'lucide-react'
import { cn } from '@/app/lib/@system/utils'

const VARIANTS = {
  default: {
    bg: 'bg-brand-primary',
    text: 'text-brand-text-on-primary',
    icon: Megaphone,
  },
  info: {
    bg: 'bg-[var(--color-info)]',
    text: 'text-white',
    icon: Info,
  },
  warning: {
    bg: 'bg-[var(--color-warning)]',
    text: 'text-[var(--color-warning)]',
    icon: AlertTriangle,
  },
  success: {
    bg: 'bg-[var(--color-success)]',
    text: 'text-white',
    icon: Sparkles,
  },
  gradient: {
    bg: 'bg-gradient-to-r from-primary via-purple-500 to-pink-500',
    text: 'text-white',
    icon: Sparkles,
  },
}

/**
 * AnnouncementBanner — Dismissible top banner for announcements
 * @param {Object} props
 * @param {string} props.id - Unique ID for persistent dismiss (stored in localStorage)
 * @param {string} props.message - Banner message text
 * @param {'default'|'info'|'warning'|'success'|'gradient'} [props.variant='default'] - Visual variant
 * @param {Object} [props.action] - CTA button config
 * @param {string} props.action.label - Button text
 * @param {string} [props.action.href] - Link URL
 * @param {Function} [props.action.onClick] - Click handler
 * @param {boolean} [props.dismissible=true] - Allow dismissing
 * @param {boolean} [props.persist=true] - Remember dismiss in localStorage
 * @param {string} [props.className] - Additional CSS classes
 */
export function AnnouncementBanner({
  id,
  message,
  variant = 'default',
  action,
  dismissible = true,
  persist = true,
  className,
}) {
  const storageKey = `announcement-${id}-dismissed`
  const [dismissed, setDismissed] = useState(() => {
    if (!persist) return false
    try {
      return localStorage.getItem(storageKey) === 'true'
    } catch {
      return false
    }
  })

  if (dismissed) return null

  const v = VARIANTS[variant] || VARIANTS.default
  const Icon = v.icon

  const handleDismiss = () => {
    setDismissed(true)
    if (persist) {
      try {
        localStorage.setItem(storageKey, 'true')
      } catch {}
    }
  }

  return (
    <div className={cn('relative w-full', v.bg, v.text, className)}>
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-2.5">
        <Icon className="h-4 w-4 sm:h-4 sm:w-4 shrink-0 opacity-80" />

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-center sm:text-left">
            {message}
          </p>

          {action && (
            action.href ? (
              <a
                href={action.href}
                className="inline-flex items-center justify-center gap-1 rounded-full bg-white/20 px-3 py-1.5 sm:py-1 text-xs font-semibold backdrop-blur-sm hover:bg-white/30 transition-colors shrink-0 touch-target"
              >
                {action.label}
                <ArrowRight className="h-3 w-3" />
              </a>
            ) : (
              <button
                onClick={action.onClick}
                className="inline-flex items-center justify-center gap-1 rounded-full bg-white/20 px-3 py-1.5 sm:py-1 text-xs font-semibold backdrop-blur-sm hover:bg-white/30 transition-colors shrink-0 touch-target"
              >
                {action.label}
                <ArrowRight className="h-3 w-3" />
              </button>
            )
          )}
        </div>

        {dismissible && (
          <button
            onClick={handleDismiss}
            className="shrink-0 rounded-full p-1.5 sm:p-1 opacity-70 hover:opacity-100 transition-opacity touch-target"
            aria-label="Dismiss announcement"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
