// @system — Dashboard layout with nav-registry-driven sidebar
// Reads navigation config passed as props from @custom.
// Desktop: persistent collapsible sidebar (no top header — logo in sidebar)
// Mobile: hamburger FAB -> Sheet drawer

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Sidebar } from '../../Sidebar'
import { cn } from '@/app/lib/@system/utils'

const EMPTY_NAV = []
const EMPTY_SECTIONS = []

export function DashboardLayout({
  children,
  navItems = EMPTY_NAV,
  sections = EMPTY_SECTIONS,
  badges = {},
  user = null,
  onLogout = null,
  theme = 'dark',
  onToggleTheme = null,
  showSidebar = true,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex h-screen bg-[var(--brand-bg)]">
      {/* Mobile hamburger FAB */}
      {showSidebar && (
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="lg:hidden fixed bottom-5 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] shadow-lg hover:opacity-90 transition-opacity"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Sidebar */}
      {showSidebar && (
        <Sidebar
          navItems={navItems}
          sections={sections}
          badges={badges}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
          user={user}
          onLogout={onLogout}
          theme={theme}
          onToggleTheme={onToggleTheme}
        />
      )}

      {/* Main content */}
      <main id="main-content" className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}

DashboardLayout.Header = function DashboardHeader({ title, description, actions, className }) {
  return (
    <div className={cn(
      'flex flex-col gap-3 mb-5',
      'sm:flex-row sm:items-start sm:justify-between',
      className
    )}>
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--brand-text)]">{title}</h1>
        {description && (
          <p className="mt-0.5 text-sm text-[var(--brand-text-secondary)]">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  )
}

DashboardLayout.Content = function DashboardContent({ children, className, noPadding = false }) {
  return (
    <div className={cn(
      !noPadding && 'p-4 sm:p-5 lg:p-6',
      className
    )}>
      {children}
    </div>
  )
}

DashboardLayout.Section = function DashboardSection({ children, title, description, actions, className, ...rest }) {
  return (
    <section className={cn('mb-5 sm:mb-6', className)} {...rest}>
      {(title || actions) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-3">
          {title && (
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-[var(--brand-text)]">{title}</h2>
              {description && (
                <p className="text-sm text-[var(--brand-text-secondary)] mt-0.5">{description}</p>
              )}
            </div>
          )}
          {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
