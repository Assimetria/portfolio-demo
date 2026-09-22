// @system — Landing page footer: link columns, social icons, legal bar
// @custom — Customise FOOTER_LINKS and social links via @custom/info.js
import { Link } from 'react-router-dom'
import { Twitter, Github, Linkedin, Youtube, Mail } from 'lucide-react'
import { info } from '@/config'
import { pages as customPages } from '@/app/config/@custom/navigation'
import { systemPages } from '@/app/config/@system/navigation-defaults'
import { mergePages } from '@/app/config/@system/navigation-merge'

// ── Link columns ─────────────────────────────────────────────────────────────
// Pages flagged `footer: true` (optionally `footerSection`) in the navigation
// registry (@system defaults merged with @custom/navigation.js `pages`).
const FOOTER_LINKS = (() => {
  const groups = {}
  const allPages = mergePages(systemPages, customPages || [])
  for (const p of allPages.filter(p => p.footer)) {
    const section = p.footerSection || 'Links'
    if (!groups[section]) groups[section] = { label: section, links: [] }
    groups[section].links.push({ title: p.label, href: p.path })
  }
  return Object.values(groups)
})()

// ── Social links — derived from info.social in @custom/info.js ───────────────
// Set social.twitter, social.github, etc. in @custom/info.js to show icons.
// Keys not present are hidden. Entire section hidden when info.social is empty.
const SOCIAL_ICON_MAP = {
  twitter: { label: 'Twitter / X', icon: Twitter },
  github:  { label: 'GitHub',      icon: Github },
  linkedin:{ label: 'LinkedIn',    icon: Linkedin },
  youtube: { label: 'YouTube',     icon: Youtube },
  email:   { label: 'Email',       icon: Mail },
}

const SOCIAL_LINKS = Object.entries(info.social ?? {})
  .filter(([key, href]) => href && SOCIAL_ICON_MAP[key])
  .map(([key, href]) => ({ ...SOCIAL_ICON_MAP[key], href }))

// ── Component ─────────────────────────────────────────────────────────────────
export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-[var(--brand-border-subtle)] bg-brand-bg">
      {/* ── Main columns ───────────────────────────────────────────────────── */}
      <div className="container mx-auto px-4 py-12 sm:py-16 md:py-20 grid grid-cols-2 gap-8 sm:gap-10 md:gap-12 md:grid-cols-4 lg:grid-cols-5">
        {/* Brand column */}
        <div className="col-span-2 md:col-span-4 lg:col-span-1 flex flex-col gap-3 sm:gap-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-base sm:text-lg text-brand-text hover:opacity-80 transition-opacity">
            <img src={info.logo} alt="" className="h-8 w-8" />
            {info.name}
          </Link>
          <p className="text-xs sm:text-sm text-brand-text-muted leading-relaxed max-w-[280px] sm:max-w-[220px]">
            {info.tagline}
          </p>

          {/* Social icons — only rendered when info.social has configured links */}
          {SOCIAL_LINKS.length > 0 && (
            <div className="flex items-center gap-2 sm:gap-3 mt-1">
              {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target={href.startsWith('mailto') ? undefined : '_blank'}
                  rel={href.startsWith('mailto') ? undefined : 'noopener noreferrer'}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Link columns */}
        {FOOTER_LINKS.map((col) => (
          <div key={col.label} className="flex flex-col gap-2 sm:gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-text mb-1">
              {col.label}
            </h3>
            <ul className="space-y-1.5 sm:space-y-2">
              {col.links.map(({ title, href, external }) => (
                <li key={title}>
                  {external ? (
                    <a
                      href={href}
                      className="text-xs sm:text-sm text-brand-text-muted hover:text-brand-text transition-colors inline-block"
                      target={href.startsWith('mailto') ? undefined : '_blank'}
                      rel={href.startsWith('mailto') ? undefined : 'noopener noreferrer'}
                    >
                      {title}
                    </a>
                  ) : (
                    <Link
                      to={href}
                      className="text-xs sm:text-sm text-brand-text-muted hover:text-brand-text transition-colors inline-block"
                    >
                      {title}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* ── Legal bar ──────────────────────────────────────────────────────── */}
      <div className="border-t border-[var(--brand-border-subtle)]">
        <div className="container mx-auto px-4 py-4 sm:py-5 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3 text-xs text-brand-text-muted">
          <p className="text-center sm:text-left">© {year} {info.name}. All rights reserved.</p>
          <div className="flex items-center gap-3 sm:gap-5 flex-wrap justify-center">
            <Link to="/privacy" className="hover:text-brand-text transition-colors whitespace-nowrap">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-brand-text transition-colors whitespace-nowrap">
              Terms of Service
            </Link>
            <Link to="/cookies" className="hover:text-brand-text transition-colors whitespace-nowrap">
              Cookie Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
