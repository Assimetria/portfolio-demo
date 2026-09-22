# Adding a page

> Purpose: the three files you touch to add an authenticated or public page in a product built on the template.
> Last verified: 2026-09-20 (`client/src/app/routes/@system/AppRoutes.jsx`, `routes/@system/utils.js`, `components/@system/Sidebar/index.jsx`, `config/@custom/navigation.js`).

## 1. Component

```jsx
// client/src/app/pages/app/@custom/ProjectsPage/index.jsx
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/@system/ui/card'

export function ProjectsPage() {
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <h1 className="text-2xl font-semibold text-brand-text">Projects</h1>
      <Card>
        <CardHeader><CardTitle>Nothing here yet</CardTitle></CardHeader>
        <CardContent className="text-brand-text-muted">Create your first project.</CardContent>
      </Card>
    </div>
  )
}
export default ProjectsPage
```

Public pages go in `client/src/app/pages/static/@custom/<Name>Page/index.jsx` instead.

## 2. Route

Routes are data. `AppRoutes` merges `customRoutes` over the template's `systemRoutes` by `path` (there is no auto-router; the navigation registry below does not create routes).

```jsx
// client/src/app/routes/@custom/index.jsx
import { lazy } from 'react'
import { ProtectedRoute } from '../../components/@system/ProtectedRoute'

const ProjectsPage = lazy(() => import('../../pages/app/@custom/ProjectsPage').then((m) => ({ default: m.ProjectsPage })))

export const customRoutes = [
  { path: '/app/projects', element: <ProtectedRoute><ProjectsPage /></ProtectedRoute> },
  // public page:  { path: '/changelog', element: <MyChangelogPage /> }   (same path as a system route replaces it)
  // admin only:   { path: '/app/projects/admin', element: <ProtectedRoute role="admin"><AdminProjects /></ProtectedRoute> }
]
```

Build the element in the route object (not conditionally at render time; Terser drops render-time wrappers in production).

## 3. Sidebar entry (authenticated pages)

```js
// client/src/app/config/@custom/navigation.js  -> export const pages = [ ... ]
{
  path: '/app/projects',
  label: 'Projects',
  icon: 'FolderKanban',      // any lucide-react icon name, see https://lucide.dev/icons
  sidebar: true,
  section: 'main',           // 'main' | 'account' | a key from the sections export
  order: 10,
  requiresAuth: true,
}
```

The sidebar merges these entries over `config/@system/navigation-defaults.js` by `path`; using a system path (for example `/app/settings`) replaces that item. Field reference is in the header comment of `navigation.js` (children, badges, dividers, `requiredRole`, `hideWhenCollapsed`, ...). The `component` field documented there is not used for routing today.

## 4. Check

```bash
npm run dev                 # visit http://localhost:3000/app/projects (login first)
(cd client && npm run lint && npm test)
npm run build
```

Add a test in `client/src/test/@custom/ProjectsPage.test.jsx` and, if the page is user-facing, an e2e in `e2e/@custom/`.

## 5. Page chrome

- `/app/*` pages render inside the dashboard shell provided by the `@system` Dashboard components used by the page itself (see `pages/app/@system/HomePage` for the pattern with `DashboardLayout`).
- Public pages get `Header`/`Footer` from `components/@system/PageLayout` when wrapped with it; the `@system` static pages do this themselves.
- `/auth` and error pages are bare.

SEO metadata for static routes is injected server-side by `spaFallback` from `client/src/app/routes/@system/manifest.json`; add an entry there only when working in the template repo.
