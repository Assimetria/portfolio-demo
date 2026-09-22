// @system — Navigation merge logic
// Merges system defaults with @custom product pages.
// Custom entries override system entries when paths match.
// This is the engine behind the navigation registry pattern.

import { isModuleEnabled } from '@/config/@system/modules'

/**
 * @typedef {Object} ChildEntry
 * @property {string} path - Route path
 * @property {string} label - Display label
 * @property {string} [icon] - Lucide icon name
 * @property {boolean} [disabled] - Grey out this child
 * @property {string} [tooltip] - Hover tooltip
 * @property {string|null} [badgeKey] - Dynamic badge key
 * @property {string} [badgeColor] - Badge color variant
 */

/**
 * @typedef {Object} PageEntry
 * @property {string} path - Route path (must be unique)
 * @property {string} label - Display label in sidebar/topbar
 * @property {string} icon - Lucide icon name (e.g. 'LayoutDashboard')
 * @property {boolean} [sidebar=false] - Show in sidebar?
 * @property {boolean} [topbar=false] - Show in topbar?
 * @property {string} [section='main'] - Sidebar section group key
 * @property {number} [order=50] - Sort order within section (lower = higher)
 *
 * @property {ChildEntry[]} [children] - Sub-pages (collapsible in sidebar)
 * @property {boolean} [clickable=true] - Is the parent item clickable? (false = group header only)
 * @property {boolean} [collapsible=true] - Can children be toggled?
 * @property {boolean} [defaultExpanded=false] - Start expanded?
 * @property {boolean} [highlight=true] - Show active state?
 * @property {boolean} [highlightChildren=true] - Highlight parent when child is active?
 *
 * @property {boolean} [dividerBefore=false] - Divider line before this item
 * @property {boolean} [dividerAfter=false] - Divider line after this item
 * @property {boolean} [disabled=false] - Greyed out, not clickable
 * @property {string} [tooltip] - Hover tooltip
 *
 * @property {string|null} [badgeKey=null] - Key for dynamic badge (e.g. 'inbox')
 * @property {string} [badgeColor='red'] - Badge color variant
 *
 * @property {boolean} [requiresAuth=false] - Only show when authenticated
 * @property {string|null} [requiredRole=null] - Role required (e.g. 'admin', 'pro')
 * @property {string|null} [module=null] - brand.json feature module that owns this page (e.g. 'billing'); hidden when off
 * @property {boolean} [hideWhenCollapsed=false] - Hide in icon-only mode
 *
 * @property {Function} [component] - Lazy import function for AutoRouter
 * @property {boolean} [showHeader=true] - Show header on this page
 * @property {boolean} [showFooter=false] - Show footer on this page
 */

/**
 * Merge system + custom pages. Custom wins on path collision.
 * @param {PageEntry[]} systemPages
 * @param {PageEntry[]} customPages
 * @returns {PageEntry[]}
 */
export function mergePages(systemPages, customPages) {
  const map = new Map()

  // System pages first
  for (const page of systemPages) {
    map.set(page.path, page)
  }

  // Custom pages override by path
  for (const page of customPages) {
    map.set(page.path, page)
  }

  return Array.from(map.values())
}

/**
 * Drop pages (and their children) whose `module` field names a feature module
 * that brand.json switches off. Pages without `module` are always kept.
 * Applied by Sidebar / LandingNavbar / Footer after mergePages().
 * @param {PageEntry[]} pages
 * @param {(key: string) => boolean} [isEnabled]
 * @returns {PageEntry[]}
 */
export function filterPagesByModules(pages, isEnabled = isModuleEnabled) {
  return pages
    .filter((p) => !p.module || isEnabled(p.module))
    .map((p) => (p.children?.length
      ? { ...p, children: p.children.filter((c) => !c.module || isEnabled(c.module)) }
      : p))
}

/**
 * Merge section definitions. Custom sections override by key.
 * @param {Array<{key: string, label: string|null, order?: number}>} systemSections
 * @param {Array<{key: string, label: string|null, order?: number}>} customSections
 * @returns {Array<{key: string, label: string|null, order: number}>}
 */
export function mergeSections(systemSections, customSections) {
  const map = new Map()

  for (const s of systemSections) {
    map.set(s.key, { order: 50, ...s })
  }
  for (const s of customSections) {
    map.set(s.key, { order: 50, ...s })
  }

  return Array.from(map.values()).sort((a, b) => a.order - b.order)
}

/**
 * Get sidebar items from merged pages, grouped by section.
 * @param {PageEntry[]} pages
 * @param {Array<{key: string, label: string|null, order: number}>} sections
 * @returns {Array<{key: string, label: string|null, items: PageEntry[]}>}
 */
export function getSidebarGroups(pages, sections) {
  const sidebarPages = pages.filter(p => p.sidebar)
  return sections
    .map(section => ({
      ...section,
      items: sidebarPages
        .filter(p => (p.section || 'main') === section.key)
        .sort((a, b) => (a.order ?? 50) - (b.order ?? 50)),
    }))
    .filter(g => g.items.length > 0)
}

/**
 * Get topbar items from merged pages.
 * @param {PageEntry[]} pages
 * @returns {PageEntry[]}
 */
export function getTopbarItems(pages) {
  return pages
    .filter(p => p.topbar)
    .sort((a, b) => (a.order ?? 50) - (b.order ?? 50))
}
