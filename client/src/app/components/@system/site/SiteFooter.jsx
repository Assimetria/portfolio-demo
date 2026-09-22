// @system — Site footer: brand + tagline + social, link columns, legal bar.
// Content from site.footer; Pricing/Blog/Login links only appear when the
// matching site.features flag is on.
import { Twitter, Github, Linkedin, Youtube, Mail, Instagram, Facebook } from 'lucide-react'
import { Link } from 'react-router-dom'
import { info, site } from '@/config'
import { SmartCta } from './SmartLink'

const SOCIAL = {
  twitter: { label: 'Twitter / X', icon: Twitter },
  github: { label: 'GitHub', icon: Github },
  linkedin: { label: 'LinkedIn', icon: Linkedin },
  youtube: { label: 'YouTube', icon: Youtube },
  instagram: { label: 'Instagram', icon: Instagram },
  facebook: { label: 'Facebook', icon: Facebook },
  email: { label: 'Email', icon: Mail },
}

const GATED = { '/pricing': 'showPricing', '/blog': 'showBlog', '/auth': 'showAuth', '/app': 'showAuth' }

function allowed(link, features) {
  const flag = GATED[link.href]
  return !flag || Boolean(features?.[flag])
}

export function SiteFooter() {
  const footer = site.footer ?? {}
  const features = site.features ?? {}
  const year = new Date().getFullYear()
  const social = Object.entries({ ...(info.social ?? {}), ...(footer.social ?? {}) }).filter(([k, v]) => v && SOCIAL[k])
  const columns = (footer.columns ?? []).map((c) => ({ ...c, links: (c.links ?? []).filter((l) => allowed(l, features)) })).filter((c) => c.links.length)
  const extra = []
  if (features.showPricing) extra.push({ label: 'Pricing', href: '/pricing' })
  if (features.showBlog) extra.push({ label: 'Blog', href: '/blog' })
  if (features.showAuth) extra.push({ label: 'Log in', href: '/auth' })
  const legal = (footer.legalLinks ?? []).filter((l) => allowed(l, features))
  const copyright = footer.copyright || `© ${year} ${info.name}. All rights reserved.`

  return (
    <footer className="border-t border-brand-border bg-brand-bg" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <div className="container grid grid-cols-2 gap-8 py-12 sm:py-16 md:grid-cols-4 lg:grid-cols-5">
        <div className="col-span-2 flex flex-col gap-4 md:col-span-4 lg:col-span-2">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold text-brand-text hover:opacity-80 transition-opacity rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">
            {info.logo && <img src={info.logo} alt="" className="h-8 w-8" width={32} height={32} />}
            {info.name}
          </Link>
          {(footer.tagline || info.tagline) && (
            <p className="max-w-xs text-sm leading-relaxed text-brand-text-secondary">{footer.tagline || info.tagline}</p>
          )}
          {social.length > 0 && (
            <ul className="mt-1 flex items-center gap-2" aria-label="Social links">
              {social.map(([key, href]) => {
                const { label, icon: Icon } = SOCIAL[key]
                const url = key === 'email' && !href.startsWith('mailto:') ? `mailto:${href}` : href
                const ext = url.startsWith('http')
                return (
                  <li key={key}>
                    <a
                      href={url}
                      aria-label={label}
                      target={ext ? '_blank' : undefined}
                      rel={ext ? 'noopener noreferrer' : undefined}
                      className="flex h-9 w-9 items-center justify-center rounded-md text-brand-text-muted hover:bg-brand-surface-hover hover:text-brand-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title} className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-text">{col.title}</h3>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.href + l.label}>
                  <SmartCta href={l.href} className="text-sm text-brand-text-secondary hover:text-brand-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded-sm">
                    {l.label}
                  </SmartCta>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        {extra.length > 0 && (
          <nav aria-label="More" className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-text">More</h3>
            <ul className="space-y-2">
              {extra.map((l) => (
                <li key={l.href}>
                  <Link to={l.href} className="text-sm text-brand-text-secondary hover:text-brand-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded-sm">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>

      <div className="border-t border-brand-border">
        <div className="container flex flex-col items-center justify-between gap-3 py-5 text-xs text-brand-text-muted sm:flex-row">
          <p className="text-center sm:text-left">{copyright}</p>
          {legal.length > 0 && (
            <ul className="flex flex-wrap items-center justify-center gap-4">
              {legal.map((l) => (
                <li key={l.href}>
                  <SmartCta href={l.href} className="hover:text-brand-text transition-colors whitespace-nowrap">
                    {l.label}
                  </SmartCta>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </footer>
  )
}

export default SiteFooter
