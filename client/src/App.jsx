// App.jsx — root: global providers + error boundary + router + routes.
// Per-page chrome (header, footer, cookie banner) is rendered by PageLayout,
// which wraps each route in AppRoutes.jsx.
//
// Provider order matters:
//   ThemeProvider           — light | dark | system; owns <html data-theme> + .dark
//   ErrorBoundary           — catches render crashes below it
//   BrowserRouter           — <Analytics /> and <AppRoutes /> both need a Router
//   BrandProvider           — runtime brand tokens (primary/accent → CSS custom properties)
//   AuthProvider            — cookie-session auth (GET /api/sessions/me)
//   UpgradeProvider         — shared in-app upgrade modal (useUpgradeModal)
//   GlobalDateRangeProvider — shared reporting window (admin pages)
//
// History: commit de56e8c9 (2026-09-05) dropped the providers AND the router
// while reworking the layout; every product built from the template since then
// rendered only the ErrorBoundary fallback. Keep this file minimal, but never
// remove a provider that @system components depend on.

import { BrowserRouter } from "react-router-dom"
import { AppRoutes } from "./app/routes/@system/AppRoutes"
import { ErrorBoundary } from "./app/components/@system/ErrorBoundary"
import { SkipToContent } from "./app/components/@system/SkipToContent"
import { Toaster } from "./app/components/@custom/Toaster"
import Analytics from "./app/components/@system/Analytics"
import { ThemeProvider } from "./app/store/@system/theme"
import { BrandProvider } from "./app/store/@system/brand"
import { AuthProvider } from "./app/store/@system/auth"
import { UpgradeProvider } from "./app/store/@system/upgradeModal"
import { GlobalDateRangeProvider } from "./app/store/@system/dateRange"

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <BrandProvider>
            <AuthProvider>
              <UpgradeProvider>
                <GlobalDateRangeProvider>
                  <SkipToContent />
                  <Analytics />
                  <AppRoutes />
                  <Toaster />
                </GlobalDateRangeProvider>
              </UpgradeProvider>
            </AuthProvider>
          </BrandProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  )
}
