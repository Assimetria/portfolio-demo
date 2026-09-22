import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useAuthContext } from '../../store/@system/auth'
import { Spinner } from '../../components/@system/Loading'
import { ProtectedRoute } from '../../components/@system/ProtectedRoute'
import { mergeRoutes, filterRoutesByModules } from './utils'
import { customRoutes } from '../@custom'
import { isModuleEnabled } from '../../../config/@system/modules'

// Feature modules (brand.json `modules`): routes below carry `module: '<key>'`
// and are dropped by filterRoutesByModules() when that module is off. With
// selfRegistration off, /register and /signup land on the login tab.
const REGISTER_TARGET = isModuleEnabled('selfRegistration') ? '/auth?tab=register' : '/auth'

// Static / marketing pages — grouped into "pages-static" chunk
// The informational home page (/) is SitePage, loaded through its @custom
// delegate — products customise composition in pages/static/@custom/SitePage
// and copy in content/@custom/site.js (not this file). The SaaS LandingPage is
// kept at /saas-landing for reference.

const SitePage = lazy(() =>
  import(/* webpackChunkName: "pages-site" */ '../../pages/static/@custom/SitePage').then((m) => ({ default: m.SitePage }))
)

const ContactSubmissionsPage = lazy(() =>
  import(/* webpackChunkName: "pages-app" */ '../../pages/app/@system/ContactSubmissionsPage').then((m) => ({ default: m.ContactSubmissionsPage }))
)

const AboutPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/AboutPage').then((m) => ({ default: m.AboutPage }))
)

const ArticlePage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/ArticlePage').then((m) => ({ default: m.ArticlePage }))
)

const AuthPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/AuthPage').then((m) => ({ default: m.AuthPage }))
)

const BlogPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/BlogPage').then((m) => ({ default: m.BlogPage }))
)

const BlogPostPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/BlogPostPage').then((m) => ({ default: m.BlogPostPage }))
)

const CareersPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/CareersPage').then((m) => ({ default: m.CareersPage }))
)

const ChangelogPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/ChangelogPage').then((m) => ({ default: m.ChangelogPage }))
)

const ContactPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/ContactPage').then((m) => ({ default: m.ContactPage }))
)

const ConversionPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/ConversionPage').then((m) => ({ default: m.ConversionPage }))
)

const CookiePolicyPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/CookiePolicyPage').then((m) => ({ default: m.CookiePolicyPage }))
)

const DPAPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/DPAPage').then((m) => ({ default: m.DPAPage }))
)

const DocsPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/DocsPage').then((m) => ({ default: m.DocsPage }))
)

const ErrorPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/ErrorPage').then((m) => ({ default: m.ErrorPage }))
)

const ForgotPasswordPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage }))
)

const HelpCenterPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/HelpCenterPage').then((m) => ({ default: m.HelpCenterPage }))
)

const LandingPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/LandingPage').then((m) => ({ default: m.LandingPage }))
)

const LoginPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/LoginPage').then((m) => ({ default: m.LoginPage }))
)

const NotFoundPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/NotFoundPage').then((m) => ({ default: m.NotFoundPage }))
)

const OnboardingPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/OnboardingPage').then((m) => ({ default: m.OnboardingPage }))
)

const PricingPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/PricingPage').then((m) => ({ default: m.PricingPage }))
)

const PrivacyPolicyPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage }))
)

const RefundPolicyPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/RefundPolicyPage').then((m) => ({ default: m.RefundPolicyPage }))
)

const ResetPasswordPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage }))
)

const RoadmapPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/RoadmapPage').then((m) => ({ default: m.RoadmapPage }))
)

const TermsPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/TermsPage').then((m) => ({ default: m.TermsPage }))
)

const TwoFactorVerifyPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/TwoFactorVerifyPage').then((m) => ({ default: m.TwoFactorVerifyPage }))
)

const VerifyEmailPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage }))
)

const ThankYouPage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/ThankYouPage').then((m) => ({ default: m.ThankYouPage }))
)

const UnsubscribePage = lazy(() =>
  import(/* webpackChunkName: "pages-static" */ '../../pages/static/@system/UnsubscribePage').then((m) => ({ default: m.UnsubscribePage }))
)

// App pages (auth required) — grouped into "pages-app" chunk
const ActivityPage = lazy(() =>
  import(/* webpackChunkName: "pages-app" */ '../../pages/app/@system/ActivityPage').then((m) => ({ default: m.ActivityPage }))
)

const AdminPage = lazy(() =>
  import(/* webpackChunkName: "pages-app" */ '../../pages/app/@system/AdminPage').then((m) => ({ default: m.AdminPage }))
)

const ApiKeysPage = lazy(() =>
  import(/* webpackChunkName: "pages-app" */ '../../pages/app/@system/ApiKeysPage').then((m) => ({ default: m.ApiKeysPage }))
)

const BillingPage = lazy(() =>
  import(/* webpackChunkName: "pages-app" */ '../../pages/app/@system/BillingPage').then((m) => ({ default: m.BillingPage }))
)

const BlogManagementPage = lazy(() =>
  import(/* webpackChunkName: "pages-app" */ '../../pages/app/@system/BlogManagementPage').then((m) => ({ default: m.BlogManagementPage }))
)

const CancellationsPage = lazy(() =>
  import(/* webpackChunkName: "pages-app" */ '../../pages/app/@system/AdminPage/CancellationsPage').then((m) => ({ default: m.CancellationsPage }))
)

const HomePage = lazy(() =>
  import(/* webpackChunkName: "pages-app" */ '../../pages/app/@system/HomePage').then((m) => ({ default: m.HomePage }))
)

const IntegrationsPage = lazy(() =>
  import(/* webpackChunkName: "pages-app" */ '../../pages/app/@system/IntegrationsPage').then((m) => ({ default: m.IntegrationsPage }))
)

const MobileResponsiveDemo = lazy(() =>
  import(/* webpackChunkName: "pages-app" */ '../../pages/app/@system/MobileResponsiveDemo').then((m) => ({ default: m.MobileResponsiveDemo }))
)

const SettingsPage = lazy(() =>
  import(/* webpackChunkName: "pages-app" */ '../../pages/app/@system/SettingsPage').then((m) => ({ default: m.SettingsPage }))
)

const TeamsPage = lazy(() =>
  import(/* webpackChunkName: "pages-app" */ '../../pages/app/@system/TeamsPage').then((m) => ({ default: m.TeamsPage }))
)

const UXDemoPage = lazy(() =>
  import(/* webpackChunkName: "pages-app" */ '../../pages/app/@system/UXDemoPage').then((m) => ({ default: m.UXDemoPage }))
)

const WebhooksPage = lazy(() =>
  import(/* webpackChunkName: "pages-app" */ '../../pages/app/@system/WebhooksPage').then((m) => ({ default: m.WebhooksPage }))
)

function PageFallback() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Spinner />
    </div>
  )
}

/** Redirects authenticated users away from /auth back to /app */
function GuestRoute({ children }) {
  const { isAuthenticated, loading } = useAuthContext()
  if (loading) return <PageFallback />
  if (isAuthenticated) return <Navigate to="/app" replace />
  return <>{children}</>
}

// @system route definitions as data — products override via @custom/index.jsx + mergeRoutes()
const systemRoutes = [
  { path: '/', element: <SitePage /> },
  { path: '/saas-landing', element: <LandingPage /> },
  { path: '/app/contact', element: <ProtectedRoute role="admin"><ContactSubmissionsPage /></ProtectedRoute> },
  { path: '/login', element: <Navigate to="/auth" replace /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/verify-email', element: <VerifyEmailPage /> },
  { path: '/terms', element: <TermsPage /> },
  { path: '/privacy', element: <PrivacyPolicyPage /> },
  { path: '/refund-policy', element: <RefundPolicyPage /> },
  { path: '/cookies', element: <CookiePolicyPage /> },
  { path: '/pricing', element: <PricingPage />, module: 'billing' },
  { path: '/help', element: <HelpCenterPage /> },
  { path: '/help/:slug', element: <ArticlePage /> },
  { path: '/blog', element: <BlogPage />, module: 'blog' },
  { path: '/blog/:slug', element: <BlogPostPage />, module: 'blog' },
  { path: '/about', element: <AboutPage /> },
  { path: '/changelog', element: <ChangelogPage /> },
  { path: '/roadmap', element: <RoadmapPage /> },
  { path: '/careers', element: <CareersPage /> },
  { path: '/docs', element: <DocsPage /> },
  // The informational contact form lives in the site page (#contact); the SaaS
  // ContactPage faked a successful submit and is no longer routed.
  { path: '/contact', element: <Navigate to={{ pathname: '/', hash: '#contact' }} replace /> },
  { path: '/conversion', element: <ConversionPage /> },
  { path: '/thank-you', element: <ThankYouPage /> },
  { path: '/unsubscribe', element: <UnsubscribePage /> },
  { path: '/onboarding', element: <OnboardingPage />, module: 'onboarding' },
  { path: '/2fa/verify', element: <TwoFactorVerifyPage /> },
  { path: '/error', element: <ErrorPage /> },
  { path: '/auth', element: <GuestRoute><AuthPage /></GuestRoute> },
  { path: '*', element: <NotFoundPage /> },
  { path: '/register', element: <Navigate to={REGISTER_TARGET} replace /> },
  { path: '/signup', element: <Navigate to={REGISTER_TARGET} replace /> },
  { path: '/dashboard', element: <Navigate to="/app" replace /> },
  { path: '/dashboard/*', element: <Navigate to="/app" replace /> },
  { path: '/cookie-policy', element: <Navigate to="/cookies" replace /> },
  { path: '/app/activity', element: <ProtectedRoute><ActivityPage /></ProtectedRoute> },
  { path: '/app/admin', element: <ProtectedRoute role="admin"><AdminPage /></ProtectedRoute> },
  { path: '/app/api-keys', element: <ProtectedRoute><ApiKeysPage /></ProtectedRoute>, module: 'apiKeys' },
  { path: '/app/billing', element: <ProtectedRoute><BillingPage /></ProtectedRoute>, module: 'billing' },
  { path: '/app/admin/blog', element: <ProtectedRoute role="admin"><BlogManagementPage /></ProtectedRoute>, module: 'blog' },
  { path: '/app/admin/cancellations', element: <ProtectedRoute role="admin"><CancellationsPage /></ProtectedRoute>, module: 'billing' },
  { path: '/app', element: <ProtectedRoute><HomePage /></ProtectedRoute> },
  { path: '/app/integrations', element: <ProtectedRoute role="admin"><IntegrationsPage /></ProtectedRoute> },
  { path: '/app/mobile-demo', element: <ProtectedRoute><MobileResponsiveDemo /></ProtectedRoute> },
  { path: '/app/settings', element: <ProtectedRoute><SettingsPage /></ProtectedRoute> },
  { path: '/app/teams', element: <ProtectedRoute><TeamsPage /></ProtectedRoute>, module: 'teams' },
  { path: '/app/ux-demo', element: <ProtectedRoute><UXDemoPage /></ProtectedRoute> },
  { path: '/app/webhooks', element: <ProtectedRoute><WebhooksPage /></ProtectedRoute>, module: 'webhooks' },
]

export function AppRoutes() {
  const routes = mergeRoutes(filterRoutesByModules(systemRoutes), customRoutes)
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        {routes.map((r) => (
          <Route key={r.path} path={r.path} element={r.element} />
        ))}
      </Routes>
    </Suspense>
  )
}
