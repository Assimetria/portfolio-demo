// @system — Resolve lucide-react icon names from content (site.js) to components.
//
// services.items[].icon is a PascalCase lucide icon name string
// ("Compass", "Wrench", "UtensilsCrossed" …). Unknown or missing names fall
// back to `Sparkles` so a typo in content never breaks the page.
import * as Lucide from 'lucide-react'

const FALLBACK = Lucide.Sparkles

function toPascal(name) {
  return String(name)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('')
}

/**
 * @param {string} name lucide icon name (PascalCase, kebab-case also accepted)
 * @returns {import('react').ComponentType<any>}
 */
export function resolveIcon(name) {
  if (!name) return FALLBACK
  const direct = Lucide[name]
  if (typeof direct === 'function' || (direct && typeof direct === 'object')) return direct
  const pascal = Lucide[toPascal(name)]
  if (typeof pascal === 'function' || (pascal && typeof pascal === 'object')) return pascal
  return FALLBACK
}

/** Convenience component: <SiteIcon name="Compass" className="h-6 w-6" /> */
export function SiteIcon({ name, ...props }) {
  const Icon = resolveIcon(name)
  return <Icon aria-hidden="true" {...props} />
}
