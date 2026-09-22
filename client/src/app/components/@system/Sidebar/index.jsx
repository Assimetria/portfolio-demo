// @system — Self-contained sidebar component
// Reads navigation data from @custom/navigation.js automatically.
// Reads auth/theme from @system stores.
// Products NEVER import or wrap this component — it works out of the box.
//
// Features:
//   - Collapsible (icon-only ↔ full) with smooth CSS transitions
//   - Section groups with labels
//   - Children with animated chevron expand/collapse
//   - Badges with configurable colors
//   - Dividers (before/after items)
//   - Disabled state
//   - Tooltips (especially in collapsed mode)
//   - Active/highlight state with parent highlighting
//   - Mobile: Sheet drawer via hamburger FAB
//   - Persistent collapse state in localStorage
//   - Brand-aware: uses CSS variables

import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Sun, Moon, PanelLeftClose, PanelLeftOpen, ChevronRight } from 'lucide-react'
import { cn } from '@/app/lib/@system/utils'
import { resolveIcon } from '../icons'
import { info } from '@/config'
import { Sheet, SheetContent, SheetTitle } from '../ui/sheet'

// ── Navigation data (auto-imported from @custom + system defaults) ──────────
import { pages as customPages, sections as customSections } from '@/app/config/@custom/navigation'
import { systemPages, systemSections } from '@/app/config/@system/navigation-defaults'
import { mergePages, mergeSections, getSidebarGroups, filterPagesByModules } from '@/app/config/@system/navigation-merge'

const mergedSections = mergeSections(systemSections, customSections)
// Feature modules: entries tagged `module: '<key>'` (e.g. Billing) disappear
// when brand.json switches that module off.
const mergedPages = filterPagesByModules(mergePages(systemPages, customPages))
const sidebarGroups = getSidebarGroups(mergedPages, mergedSections)

// ── Collapse state persistence ──────────────────────────────────────────────
const LS_KEY = 'sidebar-collapsed'
const LS_EXPANDED_KEY = 'sidebar-expanded-groups'

function useCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(LS_KEY) === '1' } catch { return false }
  })
  const toggle = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem(LS_KEY, next ? '1' : '0') } catch {}
      return next
    })
  }, [])
  return [collapsed, toggle]
}

function useExpandedGroups(items) {
  // Track which items with children are expanded
  const [expanded, setExpanded] = useState(() => {
    // Initialize from defaults + localStorage
    const defaults = new Set()
    for (const item of items) {
      if (item.children?.length && item.defaultExpanded !== false) {
        defaults.add(item.path)
      }
    }
    try {
      const stored = JSON.parse(localStorage.getItem(LS_EXPANDED_KEY) || '[]')
      if (Array.isArray(stored)) return new Set(stored)
    } catch {}
    return defaults
  })

  const toggle = useCallback((path) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      try { localStorage.setItem(LS_EXPANDED_KEY, JSON.stringify([...next])) } catch {}
      return next
    })
  }, [])

  return [expanded, toggle]
}

// ── Badge component ─────────────────────────────────────────────────────────
const BADGE_COLORS = {
  red: 'bg-[var(--color-error)]',
  blue: 'bg-[var(--color-info)]',
  green: 'bg-[var(--color-success)]',
  yellow: 'bg-[var(--color-warning)]',
  orange: 'bg-orange-500',
  purple: 'bg-purple-500',
  default: 'bg-[var(--brand-primary)]',
}

function NavBadge({ value, color = 'default', small = false }) {
  if (value == null || value <= 0) return null
  const bg = BADGE_COLORS[color] || BADGE_COLORS.default
  const display = value > 99 ? '99+' : value
  if (small) {
    return (
      <span className={cn(
        'absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.55rem] font-bold text-brand-text-on-primary',
        bg
      )}>
        {value > 9 ? '9+' : value}
      </span>
    )
  }
  return (
    <span className={cn(
      'ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[0.65rem] font-bold text-brand-text-on-primary',
      bg
    )}>
      {display}
    </span>
  )
}

// ── Tooltip wrapper ─────────────────────────────────────────────────────────
function Tooltip({ text, children, enabled = true }) {
  if (!enabled || !text) return children
  return (
    <div className="group/tip relative">
      {children}
      <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 hidden group-hover/tip:block">
        <div className="whitespace-nowrap rounded-md bg-[var(--brand-surface)] border border-[var(--brand-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--brand-text)] shadow-lg">
          {text}
        </div>
      </div>
    </div>
  )
}

// ── Sidebar nav item ────────────────────────────────────────────────────────
function SidebarNavItem({
  item,
  active,
  collapsed,
  badges,
  hasActiveChild,
  isExpanded,
  onToggleExpand,
  onItemClick,
}) {
  const {
    icon: iconName,
    label,
    path,
    children,
    clickable = true,
    collapsible = true,
    disabled = false,
    tooltip,
    badgeKey,
    badgeColor = 'default',
    hideWhenCollapsed = false,
    highlight = true,
    highlightChildren = true,
  } = item

  const Icon = resolveIcon(iconName)
  const hasChildren = children?.length > 0
  const showActive = highlight && (active || (highlightChildren && hasActiveChild))
  const badgeValue = badgeKey ? (badges[badgeKey] ?? null) : null
  const tooltipText = collapsed ? (tooltip || label) : tooltip

  if (hideWhenCollapsed && collapsed) return null

  const handleClick = (e) => {
    if (disabled) { e.preventDefault(); return }
    if (hasChildren && collapsible && !collapsed) {
      if (!clickable) { e.preventDefault(); onToggleExpand?.(path) }
      else { onToggleExpand?.(path) }
    }
    onItemClick?.()
  }

  const linkContent = (
    <Link
      to={clickable && !disabled ? path : '#'}
      onClick={handleClick}
      aria-current={active ? 'page' : undefined}
      aria-disabled={disabled || undefined}
      className={cn(
        'group relative flex items-center rounded-md text-sm font-medium transition-all duration-150',
        collapsed ? 'justify-center h-10 w-10 mx-auto' : 'gap-3 px-3 py-2',
        disabled && 'opacity-40 cursor-not-allowed',
        !disabled && showActive
          ? 'bg-[var(--brand-primary)]/15 text-[var(--brand-primary)]'
          : !disabled && 'text-[var(--brand-text-secondary)] hover:bg-[var(--brand-surface-hover)] hover:text-[var(--brand-text)]'
      )}
    >
      {/* Active indicator bar */}
      {showActive && !disabled && (
        <span className={cn(
          'absolute left-0 rounded-r-full bg-[var(--brand-primary)] transition-all',
          collapsed ? 'top-1.5 bottom-1.5 w-[3px]' : 'top-1 bottom-1 w-[3px]'
        )} />
      )}
      <Icon className={cn('shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
      {!collapsed && (
        <>
          <span className="truncate flex-1">{label}</span>
          {badgeValue != null && <NavBadge value={badgeValue} color={badgeColor} />}
          {hasChildren && collapsible && (
            <ChevronRight
              className={cn(
                'h-3.5 w-3.5 shrink-0 text-[var(--brand-text-muted)] transition-transform duration-200',
                isExpanded && 'rotate-90'
              )}
            />
          )}
        </>
      )}
      {collapsed && badgeValue != null && <NavBadge value={badgeValue} color={badgeColor} small />}
    </Link>
  )

  return (
    <Tooltip text={tooltipText} enabled={collapsed || !!tooltip}>
      {linkContent}
    </Tooltip>
  )
}

// ── Child nav item ──────────────────────────────────────────────────────────
function SidebarChildItem({ child, active, badges, onItemClick }) {
  const Icon = child.icon ? resolveIcon(child.icon) : null
  const badgeValue = child.badgeKey ? (badges[child.badgeKey] ?? null) : null
  const disabled = child.disabled

  return (
    <Link
      to={disabled ? '#' : child.path}
      onClick={disabled ? (e) => e.preventDefault() : onItemClick}
      aria-current={active ? 'page' : undefined}
      aria-disabled={disabled || undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-md py-1.5 text-[0.8rem] font-medium transition-colors',
        'pl-10 pr-3',
        disabled && 'opacity-40 cursor-not-allowed',
        !disabled && active
          ? 'text-[var(--brand-primary)] bg-[var(--brand-primary)]/8'
          : !disabled && 'text-[var(--brand-text-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-surface-hover)]'
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      <span className="truncate flex-1">{child.label}</span>
      {badgeValue != null && <NavBadge value={badgeValue} color={child.badgeColor || 'default'} />}
    </Link>
  )
}

// ── Section group ───────────────────────────────────────────────────────────
function SidebarGroup({ label, collapsed, children }) {
  return (
    <div className="mb-1">
      {!collapsed && label && (
        <div className="px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--brand-text-muted)]">
          {label}
        </div>
      )}
      {collapsed && label && (
        <div className="mx-auto my-2 h-px w-5 bg-[var(--brand-border)] opacity-50" />
      )}
      <div className="flex flex-col gap-0.5">
        {children}
      </div>
    </div>
  )
}

// ── Divider ─────────────────────────────────────────────────────────────────
function SidebarDivider() {
  return <div className="mx-3 my-1.5 h-px bg-[color-mix(in_srgb,var(--brand-border)_30%,transparent)]" />
}

// ── Sidebar inner (shared between desktop + mobile) ─────────────────────────
function SidebarInner({
  collapsed,
  onToggle,
  onItemClick,
  user,
  onLogout,
  theme,
  onToggleTheme,
  badges = {},
}) {
  const location = useLocation()

  // Enforce PageEntry.requiredRole (e.g. 'admin') against the signed-in user.
  // Entries without requiredRole are visible to every authenticated user.
  const userRole = user?.role ?? null
  const visibleGroups = sidebarGroups
    .map(g => ({ ...g, items: g.items.filter(p => !p.requiredRole || p.requiredRole === userRole) }))
    .filter(g => g.items.length > 0)

  // Flatten all sidebar items for expanded group tracking
  const allSidebarItems = visibleGroups.flatMap(g => g.items)
  const [expandedSet, toggleExpanded] = useExpandedGroups(allSidebarItems)

  const ThemeIcon = theme === 'dark' ? Moon : Sun

  function isActive(path) {
    if (path === '/app/dashboard' || path === '/app') return location.pathname === path
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  function hasActiveChild(item) {
    if (!item.children?.length) return false
    return item.children.some(c => isActive(c.path))
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo + collapse toggle */}
      <div className={cn(
        'flex items-center shrink-0 mb-2',
        collapsed ? 'flex-col gap-2 py-3' : 'justify-between px-3 py-3'
      )}>
        <Link
          to="/app/dashboard"
          className={cn(
            'flex items-center hover:opacity-80 transition-opacity',
            collapsed ? 'justify-center' : 'gap-2.5'
          )}
        >
          <img
            src={info.logoUrl || info.logo || info.logoWhite || '/logo.png'}
            alt={info.name}
            className={collapsed ? 'h-8 w-8 object-contain' : 'h-8 object-contain'}
            onError={(e) => { e.target.style.display = 'none' }}
          />

        </Link>
        {onToggle && (
          <button
            onClick={onToggle}
            className={cn(
              'flex items-center justify-center rounded-md transition-colors',
              'text-[var(--brand-text-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-surface-hover)]',
              collapsed ? 'h-8 w-8' : 'h-7 w-7'
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Navigation groups */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 scrollbar-thin" aria-label="Sidebar navigation">
        {visibleGroups.map(group => (
          <SidebarGroup key={group.key} label={group.label} collapsed={collapsed}>
            {group.items.map(item => {
              const active = isActive(item.path)
              const activeChild = hasActiveChild(item)
              const isExp = expandedSet.has(item.path)

              return (
                <div key={item.path}>
                  {item.dividerBefore && <SidebarDivider />}
                  <SidebarNavItem
                    item={item}
                    active={active}
                    collapsed={collapsed}
                    badges={badges}
                    hasActiveChild={activeChild}
                    isExpanded={isExp}
                    onToggleExpand={toggleExpanded}
                    onItemClick={onItemClick}
                  />
                  {/* Children (collapsible sub-items) */}
                  {item.children?.length > 0 && !collapsed && (
                    <div
                      className={cn(
                        'overflow-hidden transition-all duration-200 ease-in-out',
                        isExp ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                      )}
                    >
                      <div className="mt-0.5 mb-1">
                        {item.children.map(child => (
                          <SidebarChildItem
                            key={child.path}
                            child={child}
                            active={isActive(child.path)}
                            badges={badges}
                            onItemClick={onItemClick}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {item.dividerAfter && <SidebarDivider />}
                </div>
              )
            })}
          </SidebarGroup>
        ))}
      </nav>

      {/* Bottom section: user + theme + logout */}
      <div className={cn(
        'mt-auto shrink-0 border-t border-[var(--brand-border)] pt-2',
        collapsed ? 'px-1' : 'px-2'
      )}>
        {/* User info */}
        {user && !collapsed && (
          <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)]/15 text-xs font-semibold text-[var(--brand-primary)]">
              {(user.name ?? user.email ?? '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--brand-text)] truncate">{user.name ?? 'User'}</p>
              <p className="text-[0.7rem] text-[var(--brand-text-muted)] truncate">{user.email}</p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className={cn(
          'flex pb-2',
          collapsed ? 'flex-col items-center gap-1' : 'items-center gap-1 px-1'
        )}>
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className={cn(
                'flex items-center justify-center rounded-md transition-colors',
                'text-[var(--brand-text-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-surface-hover)]',
                collapsed ? 'h-10 w-10' : 'h-8 w-8'
              )}
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              <ThemeIcon className="h-4 w-4" />
            </button>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              className={cn(
                'flex items-center justify-center rounded-md transition-colors',
                'text-[var(--brand-text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10',
                collapsed ? 'h-10 w-10' : 'h-8 w-8'
              )}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Sidebar Export ─────────────────────────────────────────────────────
export function Sidebar({
  // Props are passed by DashboardLayout or directly.
  // Auth/theme/badges are provided by the layout wrapper.
  navItems,      // IGNORED — kept for backward compat, we read from merged registry
  sections,      // IGNORED — kept for backward compat
  badges = {},
  mobileOpen = false,
  onMobileClose,
  user = null,
  onLogout = null,
  theme = 'dark',
  onToggleTheme = null,
  className = '',
}) {
  const [collapsed, toggleCollapsed] = useCollapsed()

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex h-full flex-col shrink-0 border-r border-[var(--brand-border-subtle)] bg-[var(--brand-surface)] transition-[width] duration-200 ease-in-out',
          collapsed ? 'w-[68px]' : 'w-[240px]',
          className
        )}
      >
        <SidebarInner
          collapsed={collapsed}
          onToggle={toggleCollapsed}
          user={user}
          onLogout={onLogout}
          theme={theme}
          onToggleTheme={onToggleTheme}
          badges={badges}
        />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={open => !open && onMobileClose?.()}>
        <SheetContent
          side="left"
          className={cn(
            'w-[280px] p-0 border-r-0 bg-[var(--brand-surface)]',
            className
          )}
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="h-full py-2">
            <SidebarInner
              collapsed={false}
              onItemClick={onMobileClose}
              user={user}
              onLogout={onLogout}
              theme={theme}
              onToggleTheme={onToggleTheme}
              badges={badges}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

// Legacy named exports for backward compatibility
export function SidebarLogo() { return null }
export function SidebarSection({ children }) { return children }
export function SidebarItem() { return null }
