// @system — React hook for the per-page content override system.
// Wraps resolveContent() from lib/@system/content.js.
//
// Usage:
//   import { useContent } from '@/app/hooks/@system/useContent'
//   import { copyText } from '@/app/lib/@system/content'
//   const content = useContent('landing')
//   const title = copyText(content, 'heroTitle', 'Fallback')
//
// Resolution is synchronous (both @system and @custom modules are statically
// bundled), so the FIRST render already returns the merged copy — there is no
// loading state and no empty-object flash.
import { useMemo } from 'react'
import { resolveContent } from '../../lib/@system/content'

/**
 * Merged @custom + @system content for `key` (e.g. 'landing', 'pricing', 'auth').
 * Returns {} for unregistered keys.
 * @param {string} key
 * @returns {Record<string, string>}
 */
export function useContent(key) {
  return useMemo(() => resolveContent(key), [key])
}
