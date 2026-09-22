// Reference routes module — what the cloner writes to
// client/src/app/routes/@custom/index.jsx. `path: '/'` replaces SitePage via
// mergeRoutes; static paths are prerendered by client/scripts/prerender.mjs
// (dynamic ones like /blog/:slug are not). Parsed by scripts/lib/custom-routes.cjs.
import Home from './Home'
import Menu from './Menu'

export const customRoutes = [
  { path: '/', element: <Home /> },
  { path: '/menu', element: <Menu /> },
  { path: '/blog/:slug', element: <Menu /> },
]
