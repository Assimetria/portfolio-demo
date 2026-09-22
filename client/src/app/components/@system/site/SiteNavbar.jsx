// @system — Informational site navbar.
// Logo + anchor links from site.nav + CTA + theme toggle + mobile drawer.
// Login/Dashboard links are hidden unless site.features.showAuth is true.
// Content comes from content/@system/site.js (override in content/@custom/site.js).
import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Menu, X, Sun, Moon } from 'lucide-react'
import { Button } from '../ui/button'
import { useAuthContext } from '@/app/store/@system/auth'
import { useTheme } from '@/app/store/@system/theme'
import { info, site } from '@/config'
import { cn } from '@/app/lib/@system/utils'

function isAnchor(href) {
  return typeof href === 'string' && href.startsWith('#')
}

export function scrollToAnchor(href) {
  const el = document.querySelector(href)
  if (!el) return false
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  if (window.history && window.history.replaceState) {
    window.history.replaceState(null, '', href)
  }
  return true
}

export function ThemeToggle({ className }) {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      data-testid="theme-toggle"
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-md text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary',
        className,
      )}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}

export function SiteNavbar({ className }) {
  const { nav, features } = site
  const links = nav?.links ?? []
  const { isAuthenticated } = useAuthContext()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the drawer on route change and lock body scroll while it is open.
  useEffect(() => setMobileOpen(false), [location.pathname])
  useEffect(() => {
    if (!mobileOpen) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileOpen])

  function handleNavClick(e, href) {
    if (!isAnchor(href)) return // plain <Link>/<a> navigation
    e.preventDefault()
    setMobileOpen(false)
    if (location.pathname !== '/') {
      navigate('/' + href)
      return
    }
    scrollToAnchor(href)
  }

  function NavLink({ href, label, mobile = false }) {
    const base = mobile
      ? 'w-full text-left px-4 py-3 text-base font-medium text-brand-text-secondary rounded-md hover:text-brand-text hover:bg-brand-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary'
      : 'px-3 py-2 text-sm font-medium text-brand-text-secondary rounded-md hover:text-brand-text hover:bg-brand-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary'
    if (isAnchor(href)) {
      return (
        <a href={href} onClick={(e) => handleNavClick(e, href)} className={base}>
          {label}
        </a>
      )
    }
    if (/^https?:\/\//.test(href) || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return (
        <a href={href} className={base} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
          {label}
        </a>
      )
    }
    return (
      <Link to={href} className={base} onClick={() => setMobileOpen(false)}>
        {label}
      </Link>
    )
  }

  const cta = nav?.ctaLabel ? (
    isAnchor(nav.ctaHref) ? (
      <Button asChild size="sm">
        <a href={nav.ctaHref} onClick={(e) => handleNavClick(e, nav.ctaHref)}>
          {nav.ctaLabel}
        </a>
      </Button>
    ) : (
      <Button asChild size="sm">
        <Link to={nav.ctaHref || '/'}>{nav.ctaLabel}</Link>
      </Button>
    )
  ) : null

  const authLinks = features?.showAuth ? (
    isAuthenticated ? (
      <Button asChild variant="ghost" size="sm">
        <Link to="/app">Dashboard</Link>
      </Button>
    ) : (
      <Button asChild variant="ghost" size="sm">
        <Link to="/auth">Log in</Link>
      </Button>
    )
  ) : null

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-200 border-b',
        scrolled || mobileOpen
          ? 'border-brand-border bg-brand-bg/95 backdrop-blur supports-[backdrop-filter]:bg-brand-bg/80 shadow-sm'
          : 'border-transparent bg-brand-bg',
        className,
      )}
    >
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link
          to="/"
          className="flex items-center gap-2 font-bold text-brand-text hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded-md"
          aria-label={`${info.name} home`}
          onClick={() => setMobileOpen(false)}
        >
          {info.logo && <img src={info.logo} alt="" className="h-8 w-8" width={32} height={32} />}
          <span className="text-lg tracking-tight">{info.name}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
          {links.map((l) => (
            <NavLink key={l.href + l.label} {...l} />
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <ThemeToggle />
          {authLinks}
          {cta}
        </div>

        <div className="flex md:hidden items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            className="inline-flex items-center justify-center h-10 w-10 rounded-md text-brand-text hover:bg-brand-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="site-mobile-menu"
            data-testid="mobile-menu-button"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div id="site-mobile-menu" className="md:hidden border-t border-brand-border bg-brand-bg">
          <nav className="container py-4 flex flex-col gap-1" aria-label="Mobile navigation">
            {links.map((l) => (
              <NavLink key={l.href + l.label} {...l} mobile />
            ))}
            {(cta || authLinks) && (
              <div className="mt-3 pt-3 border-t border-brand-border flex flex-col gap-2">
                {features?.showAuth && (
                  <Button asChild variant="outline" className="w-full">
                    <Link to={isAuthenticated ? '/app' : '/auth'} onClick={() => setMobileOpen(false)}>
                      {isAuthenticated ? 'Dashboard' : 'Log in'}
                    </Link>
                  </Button>
                )}
                {nav?.ctaLabel && (
                  <Button asChild className="w-full">
                    {isAnchor(nav.ctaHref) ? (
                      <a href={nav.ctaHref} onClick={(e) => handleNavClick(e, nav.ctaHref)}>
                        {nav.ctaLabel}
                      </a>
                    ) : (
                      <Link to={nav.ctaHref || '/'} onClick={() => setMobileOpen(false)}>
                        {nav.ctaLabel}
                      </Link>
                    )}
                  </Button>
                )}
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}

export default SiteNavbar
