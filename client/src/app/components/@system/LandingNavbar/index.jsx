// @system — Landing page navbar: logo + nav links + login/signup CTAs + mobile menu
// @custom — to override nav links or add brand logo, extend in components/@custom/LandingNavbar/
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { Button } from '../ui/button'
import { useAuthContext } from '@/app/store/@system/auth'
import { info, isModuleEnabled } from '@/config'
import { pages as customPages } from '@/app/config/@custom/navigation'
import { systemPages } from '@/app/config/@system/navigation-defaults'
import { mergePages, getTopbarItems, filterPagesByModules } from '@/app/config/@system/navigation-merge'
import { cn } from '@/app/lib/@system/utils'

// Public (non-auth) pages flagged `topbar: true` in the navigation registry,
// minus pages whose feature module is off in brand.json.
const NAV_LINKS = getTopbarItems(filterPagesByModules(mergePages(systemPages, customPages || [])))
  .filter(p => !p.requiresAuth)
  .map(p => ({ label: p.label, href: p.path }))
const CAN_REGISTER = isModuleEnabled('selfRegistration')

export function LandingNavbar({ className }) {
  const { isAuthenticated } = useAuthContext()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function handleNavClick(href) {
    setMobileOpen(false)
    if (href.startsWith('#')) {
      const el = document.querySelector(href)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    } else {
      navigate(href)
    }
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-200',
        scrolled
          ? 'border-b border-[var(--brand-border-subtle)] bg-[var(--brand-bg)] backdrop-blur supports-[backdrop-filter]:bg-[var(--brand-bg)]/80 shadow-sm'
          : 'bg-brand-bg',
        className,
      )}
    >
      <div className="container flex h-16 items-center justify-between">
        {/* ── Logo ─────────────────────────────────────────────── */}
        <Link
          to="/"
          className="flex items-center gap-2 font-bold text-brand-text hover:opacity-80 transition-opacity"
          aria-label={`${info.name} home`}
        >
          <img src={info.logo} alt="" className="h-8 w-8" />
          <span className="text-lg tracking-tight">{info.name}</span>
        </Link>

        {/* ── Desktop nav ───────────────────────────────────────── */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
          {NAV_LINKS.map(({ label, href }) => (
            <button
              key={label}
              onClick={() => handleNavClick(href)}
              className="px-4 py-2 text-sm font-medium text-brand-text-muted rounded-md hover:text-brand-text hover:bg-brand-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              {label}
            </button>
          ))}
        </nav>

        {/* ── Desktop CTAs ──────────────────────────────────────── */}
        <div className="hidden md:flex items-center gap-2">
          {isAuthenticated ? (
            <Link to="/app">
              <Button size="sm">Go to Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm">
                  Log In
                </Button>
              </Link>
              {CAN_REGISTER && (
                <Link to="/auth?tab=register">
                  <Button size="sm">Sign Up Free</Button>
                </Link>
              )}
            </>
          )}
        </div>

        {/* ── Mobile hamburger ─────────────────────────────────── */}
        <button
          className="flex md:hidden items-center justify-center h-9 w-9 rounded-md hover:bg-brand-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* ── Mobile drawer ─────────────────────────────────────── */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[var(--brand-border-subtle)] bg-brand-bg">
          <nav className="container py-4 flex flex-col gap-1" aria-label="Mobile navigation">
            {NAV_LINKS.map(({ label, href }) => (
              <button
                key={label}
                onClick={() => handleNavClick(href)}
                className="w-full text-left px-4 py-2.5 text-sm font-medium text-brand-text-muted rounded-md hover:text-brand-text hover:bg-brand-surface-hover transition-colors"
              >
                {label}
              </button>
            ))}

            <div className="mt-3 pt-3 border-t border-[var(--brand-border-subtle)] flex flex-col gap-2">
              {isAuthenticated ? (
                <Link to="/app" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full" size="sm">
                    Go to Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/auth" onClick={() => setMobileOpen(false)}>
                    <Button variant="outline" className="w-full" size="sm">
                      Log In
                    </Button>
                  </Link>
                  {CAN_REGISTER && (
                    <Link to="/auth?tab=register" onClick={() => setMobileOpen(false)}>
                      <Button className="w-full" size="sm">
                        Sign Up Free
                      </Button>
                    </Link>
                  )}
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
