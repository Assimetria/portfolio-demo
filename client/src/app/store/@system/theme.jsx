// @system — Theme bridge: re-exports from @custom/ThemeContext
// Ensures @system components use the same theme provider as the app.

import { useContext } from "react"
import { ThemeContext, ThemeProvider as CustomThemeProvider } from "../@custom/ThemeContext"

export const ThemeProvider = CustomThemeProvider

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>")
  return ctx
}

export default { ThemeProvider, useTheme }
