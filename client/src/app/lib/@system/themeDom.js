// @system — Theme ↔ DOM contract shared by brandPrePaint (before first paint)
// and ThemeProvider (at runtime). Single place that knows HOW the theme is
// expressed on the document:
//
//   <html data-theme="light|dark">  — THE switch. Tailwind darkMode is
//                                     ['selector', '[data-theme="dark"]'] and the
//                                     generated brand.css scopes its token blocks
//                                     on [data-theme="dark"] / [data-theme="light"].
//   <html class="dark">             — kept in sync for compatibility with older
//                                     `html.dark …` CSS and third-party widgets.
//   color-scheme                    — lets native form controls/scrollbars follow.
//
// Stored preference lives in localStorage['app-theme'] as 'light' | 'dark' |
// 'system'; 'system' is resolved through prefers-color-scheme.

export const THEME_STORAGE_KEY = 'app-theme'
export const VALID_THEMES = Object.freeze(['light', 'dark', 'system'])

/** 'dark' when the OS/browser prefers dark, otherwise 'light'. */
export function getSystemTheme() {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  }
  return 'light'
}

/** Resolve a stored preference ('light' | 'dark' | 'system') to 'light' | 'dark'. */
export function resolveTheme(preference) {
  if (preference === 'dark' || preference === 'light') return preference
  return getSystemTheme()
}

/** Read the stored preference; returns null when unset/invalid/unavailable. */
export function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return VALID_THEMES.includes(stored) ? stored : null
  } catch {
    return null
  }
}

/** Persist a preference (best effort — private mode / tests may block storage). */
export function writeStoredTheme(preference) {
  if (!VALID_THEMES.includes(preference)) return
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // storage unavailable — state only
  }
}

/**
 * Apply a RESOLVED theme ('light' | 'dark') to <html>: data-theme, .dark class
 * and color-scheme, all in one place so they can never drift apart.
 */
export function applyResolvedTheme(resolved) {
  if (typeof document === 'undefined') return
  const isDark = resolved === 'dark'
  const root = document.documentElement
  root.setAttribute('data-theme', isDark ? 'dark' : 'light')
  root.classList.toggle('dark', isDark)
  root.style.colorScheme = isDark ? 'dark' : 'light'
}
