// @custom — product-specific route overrides.
// mergeRoutes() in @system/AppRoutes replaces system routes by path.
// This file is NEVER overwritten during template sync.
//
// The / route imports @custom/LandingPage which delegates to @system by default.
// Products customise the landing page by editing
// pages/static/@custom/LandingPage/index.jsx.
//
// Add product-specific route overrides below:
import FAQPage from '../pages/static/@custom/FAQPage'

export const customRoutes = [
  {
    path: '/faq',
    element: <FAQPage />,
  },
]
