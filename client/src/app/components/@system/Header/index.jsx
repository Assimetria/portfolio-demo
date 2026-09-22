// @system — top nav header with auth-aware user menu + mobile hamburger
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogOut, Settings, Shield, Menu, X, Sun, Moon, Monitor } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu'
import { Button } from '../ui/button'
import { useAuthContext } from '@/app/store/@system/auth'
import { useTheme } from '@/app/store/@system/theme'
import { info, isModuleEnabled, filterByModules } from '@/config'
import { cn } from '@/app/lib/@system/utils'

const THEME_CYCLE = { light: 'dark', dark: 'system', system: 'light' }
const THEME_ICON = { light: Sun, dark: Moon, system: Monitor }

// Feature modules: /pricing belongs to billing; the sign-up CTA to
// selfRegistration (brand.json `modules`).
const NAV_LINKS = filterByModules([
  { label: 'Features', href: '/#features' },
  { label: 'Pricing', href: '/pricing', module: 'billing' },
])
const CAN_REGISTER = isModuleEnabled('selfRegistration')

export function Header({ className = '' }) {
  const { user, isAuthenticated, logout } = useAuthContext()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

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

  const ThemeIcon = THEME_ICON[theme] ?? Sun

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  return (
    <header className={cn('border-b border-[var(--brand-border-subtle)] bg-brand-bg', className)}>
      <div className="container flex h-16 items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 font-semibold text-brand-text hover:opacity-80 transition-opacity">
          <img src={info.logo} alt="" className="h-8 w-8" />
          {info.name}
        </Link>

        {/* Desktop nav */}
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

        {/* Desktop CTAs & Theme toggle */}
        <div className="hidden sm:flex items-center gap-3">
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(THEME_CYCLE[theme] ?? 'system')}
            aria-label={`Switch theme (current: ${theme})`}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-brand-surface-hover transition-colors text-brand-text-muted hover:text-brand-text"
          >
            <ThemeIcon className="h-4 w-4" />
          </button>

          {isAuthenticated && user ? (
            <>
              <Link to="/app">
                <Button variant="ghost" size="sm">
                  Dashboard
                </Button>
              </Link>

              {/* User dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-brand-text-on-primary text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2">
                    {(user.name ?? user.email).charAt(0).toUpperCase()}
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" sideOffset={8} className="min-w-[180px]">
                  <div className="px-3 py-2 text-sm">
                    <p className="font-medium truncate">{user.name ?? 'User'}</p>
                    <p className="text-xs text-brand-text-muted truncate">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />

                  <DropdownMenuItem onSelect={() => navigate('/app/settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>

                  {user.role === 'admin' && (
                    <DropdownMenuItem onSelect={() => navigate('/app/admin')}>
                      <Shield className="mr-2 h-4 w-4" />
                      Admin
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onSelect={handleLogout}
                    className="text-[var(--color-error)] focus:text-[var(--color-error)] focus:bg-[var(--color-error-bg)]"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              {CAN_REGISTER && (
                <Link to="/auth?tab=register">
                  <Button size="sm">Get Started</Button>
                </Link>
              )}
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden flex items-center justify-center h-9 w-9 rounded-md hover:bg-brand-surface-hover transition-colors"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu drawer */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-[var(--brand-border-subtle)] bg-brand-bg px-4 py-4 flex flex-col gap-3">
          {/* Mobile nav links */}
          <nav className="flex flex-col gap-1 pb-3 border-b border-[var(--brand-border-subtle)]" aria-label="Mobile navigation">
            {NAV_LINKS.map(({ label, href }) => (
              <button
                key={label}
                onClick={() => handleNavClick(href)}
                className="w-full text-left px-4 py-2.5 text-sm font-medium text-brand-text-muted rounded-md hover:text-brand-text hover:bg-brand-surface-hover transition-colors"
              >
                {label}
              </button>
            ))}
          </nav>

          {isAuthenticated && user ? (
            <>
              <div className="px-1 pb-2 border-b border-[var(--brand-border-subtle)]">
                <p className="font-medium text-sm">{user.name ?? 'User'}</p>
                <p className="text-xs text-brand-text-muted">{user.email}</p>
              </div>
              <Link to="/app" onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  Dashboard
                </Button>
              </Link>
              <Link to="/app/settings" onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
              </Link>
              {user.role === 'admin' && (
                <Link to="/app/admin" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                    <Shield className="h-4 w-4" />
                    Admin
                  </Button>
                </Link>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-[var(--color-error)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)]"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link to="/auth" onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" size="sm" className="w-full">
                  Sign In
                </Button>
              </Link>
              {CAN_REGISTER && (
                <Link to="/auth?tab=register" onClick={() => setMobileOpen(false)}>
                  <Button size="sm" className="w-full">
                    Get Started
                  </Button>
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </header>
  )
}
