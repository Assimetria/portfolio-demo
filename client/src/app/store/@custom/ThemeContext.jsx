// @custom — Global theme context (light | dark | system).
// Consumed by @system/theme.jsx via the ThemeContext / ThemeProvider bridge so
// @system shells (AppLayout, Header, Sidebar) and the Preferences page share one
// source of truth. Products embed this provider at the app root and may specialise
// its behaviour here without touching the @system theme bridge.
//
// DOM contract (see lib/@system/themeDom.js): the resolved theme is written to
// <html data-theme="light|dark"> — the switch Tailwind and brand.css key off —
// and mirrored to the legacy `.dark` class. lib/@system/brandPrePaint.js applies
// the same contract before first paint; this provider takes over after hydration.

import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react'
import { info } from '@/config'
import {
  VALID_THEMES as THEMES,
  getSystemTheme as readSystemTheme,
  readStoredTheme,
  writeStoredTheme,
  applyResolvedTheme,
} from '@/app/lib/@system/themeDom'

export const ThemeContext = createContext(null)

export const VALID_THEMES = [...THEMES]

export const getInitialTheme = () => {
  const fallback = VALID_THEMES.includes(info?.defaultTheme) ? info.defaultTheme : 'light'
  if (typeof window === 'undefined') return fallback
  return readStoredTheme() ?? fallback
}

export const getSystemTheme = () => readSystemTheme()

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme)
  const [systemDark, setSystemDark] = useState(() => readSystemTheme() === 'dark')

  // Track OS colour-scheme so "system" stays responsive to live changes.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    if (!mql) return undefined
    const onChange = (event) => setSystemDark(!!event.matches)
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    }
    // Older Safari / jsdom fallback
    if (typeof mql.addListener === 'function') {
      mql.addListener(onChange)
      return () => mql.removeListener(onChange)
    }
    return undefined
  }, [])

  const setTheme = useCallback((nextTheme) => {
    if (!VALID_THEMES.includes(nextTheme)) return
    setThemeState(nextTheme)
    writeStoredTheme(nextTheme)
  }, [])

  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  // Keep <html data-theme> + .dark in sync with the resolved theme.
  useEffect(() => {
    applyResolvedTheme(resolvedTheme)
  }, [resolvedTheme])

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useThemeContext() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('UseThemeContext must be used inside <ThemeProvider>')
  return ctx
}
