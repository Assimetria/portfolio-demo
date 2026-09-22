// @custom — product-specific route overrides.
// mergeRoutes() in @system/AppRoutes replaces system routes by path.
// This file is NEVER overwritten during template sync.
//
// The / route imports @custom/LandingPage which delegates to @system by default.
// Products customise the landing page by editing
// pages/static/@custom/LandingPage/index.jsx.
//
// Add product-specific route overrides below:
import { SearchTestingGuide } from '../pages/app/@custom/SearchTestingGuide'
import { CachingResearch } from '../pages/app/@custom/CachingResearch'

export const customRoutes = [
  { path: '/app/search-testing-guide', element: <SearchTestingGuide /> },
  { path: '/app/caching-research', element: <CachingResearch /> },
]
