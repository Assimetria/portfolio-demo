// @custom — Product Navigation Registry (template defaults)
// ============================================================================
// SINGLE SOURCE OF TRUTH for all pages in this product.
//
// How it works:
//   1. Declare pages here with sidebar/topbar/routing config
//   2. @system/Sidebar auto-imports this — renders sidebar items
//   3. @system/routes/AutoRouter auto-imports this — generates routes
//   4. @system merges with system defaults (settings, profile, billing)
//      Custom entries OVERRIDE system defaults when paths match.
//
// To add a new page:
//   1. Create component in pages/app/@custom/YourPage/index.jsx
//   2. Add an entry below with component: () => import(...)
//   3. Done. Sidebar + routes update automatically.
//
// ============================================================================
// FIELD REFERENCE (all fields, with defaults)
// ============================================================================
//
// Required:
//   path           {string}   Route path (must be unique)
//   label          {string}   Display label in sidebar/topbar
//   icon           {string}   Lucide icon name — see https://lucide.dev/icons
//
// Navigation placement:
//   sidebar        {boolean}  [false]  Show in sidebar?
//   topbar         {boolean}  [false]  Show in topbar?
//   section        {string}   ['main'] Sidebar section group key
//   order          {number}   [50]     Sort order within section
//
// Children (collapsible sub-pages under parent):
//   children       {Array}    []       { path, label, icon?, disabled?, tooltip?, badgeKey? }
//   clickable      {boolean}  [true]   Is parent a link? (false = group header only)
//   collapsible    {boolean}  [true]   Can children be toggled?
//   defaultExpanded {boolean} [false]  Start expanded?
//
// Highlighting:
//   highlight      {boolean}  [true]   Active state when path matches
//   highlightChildren {boolean} [true] Highlight parent when child is active
//
// Visual:
//   dividerBefore  {boolean}  [false]  Divider line before this item
//   dividerAfter   {boolean}  [false]  Divider line after this item
//   disabled       {boolean}  [false]  Greyed out, not clickable
//   tooltip        {string}   [null]   Hover tooltip
//   hideWhenCollapsed {boolean} [false] Hide in icon-only mode
//
// Badges:
//   badgeKey       {string|null} [null] Dynamic badge key (e.g. 'inbox')
//   badgeColor     {string}   ['default'] 'red'|'blue'|'green'|'yellow'|'orange'|'purple'|'default'
//
// Access:
//   requiresAuth   {boolean}  [false]  Only when authenticated
//   requiredRole   {string|null} [null] e.g. 'admin', 'pro'
//
// Routing (AutoRouter):
//   component      {Function} [null]   () => import('../../pages/app/@custom/Page')
//   guard          {string}   [null]   'auth' | 'team' | null
//   showHeader     {boolean}  [true]   Show header on this page
//   showFooter     {boolean}  [false]  Show footer on this page
//
// ============================================================================

/**
 * Section definitions. Override system defaults by key.
 * @type {Array<{key: string, label: string|null, order: number}>}
 */
export const sections = [
  { key: 'main',    label: null,        order: 1 },
  { key: 'account', label: 'Account',   order: 90 },
]

/**
 * Product pages. System defaults inherited automatically.
 * Override a system default by using the same path.
 * @type {import('@/app/config/@system/navigation-merge').PageEntry[]}
 */
export const pages = [
{
    path: '/app/push-notifications',
    label: 'Push Notifications',
    icon: 'Bell',
    sidebar: true,
    section: 'main',
    order: 30,
    requiresAuth: true,
    component: () => import('../../pages/app/@custom/PushNotificationsPage'),
    guard: 'auth',
  },
  // Template ships with system defaults only.
  // Products add entries here. Example:
  //
  // {
  //   path: '/dashboard',
  //   label: 'Dashboard',
  //   icon: 'LayoutDashboard',
  //   sidebar: true,
  //   section: 'main',
  //   order: 1,
  //   requiresAuth: true,
  //   component: () => import('../../pages/app/@custom/Dashboard'),
  //   guard: 'auth',
  // },
]

// ── Public (static) pages for LandingNavbar / Footer ─────────────────────────
// @system/LandingNavbar and @system/Footer import `staticPages` from here and
// filter on `topbar` / `footer`. The merged system + custom page list is the
// right source; without this export both components received `undefined`
// (webpack warning "export 'staticPages' was not found") and rendered no links.
// Feature modules: pages tagged `module` are dropped when brand.json turns
// that module off (see @system/navigation-merge filterPagesByModules).
import { systemPages } from '../@system/navigation-defaults'
import { mergePages, filterPagesByModules } from '../@system/navigation-merge'
export const staticPages = filterPagesByModules(mergePages(systemPages, pages))
