// @system -- PageLayout: data-driven layout wrapper for all routes.
// Wraps every route element and controls which chrome (header, footer, cookie
// banner, install prompt) is shown based on config props.
//
// Page types:
//   Static pages (/, /pricing, /terms): showHeader + showFooter
//   Auth pages (/auth):                 nothing -- bare card
//   App pages (/app/*):                 handled by AppLayout (sidebar + Outlet)
//
// Usage in AppRoutes:
//   <Route path="/" element={<PageLayout><LandingPage /></PageLayout>} />
//   <Route path="/auth" element={<PageLayout showHeader={false} showFooter={false} showCookieBanner={false} showInstallPrompt={false}><AuthPage /></PageLayout>} />

import { Header } from "../Header"
import { Footer } from "../Footer"
import { CookieConsentBanner } from "../CookieConsentBanner"
import { cn } from "@/app/lib/@system/utils"

export function PageLayout({
  showHeader = true,
  showFooter = true,
  showCookieBanner = true,
  showInstallPrompt = true,
  className = "",
  children,
}) {
  return (
    <>
      {showCookieBanner && <CookieConsentBanner />}
      <div className={cn("flex flex-col min-h-screen", className)}>
        {showHeader && <Header />}
        <main className="flex-1">{children}</main>
        {showFooter && <Footer />}
      </div>
    </>
  )
}
