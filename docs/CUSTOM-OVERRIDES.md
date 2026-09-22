# Custom overrides

> Purpose: one verified, minimal example for every seam where `@custom` code extends or replaces `@system` code without editing it.
> Last verified: 2026-09-20. Paths are real; the example code follows the conventions of the neighbouring `@system` files.

Rule of thumb: find the `@system/` directory that owns the behaviour, put your file in the sibling `@custom/`, and wire it through the merge point listed below. Run `npm run set-customs` if an `@custom/` sibling is missing.

## 1. Server API route (add or override)

Merge point: `server/src/app.js` mounts `mergeRoutes(systemRoutes, customRoutes)` under `/api` with the `@custom` router first (`server/src/routes/@system/mergeRoutes.js`). Paths in route files are relative to `/api`.

```js
// server/src/api/@custom/projects.js
const express = require('express')
const { z } = require('zod')
const db = require('../../lib/@system/PostgreSQL')
const { requireAuth } = require('../../middleware/@system/auth')
const { validate } = require('../../lib/@system/Validation')
const { asyncHandler } = require('../../lib/@system/Helpers')

const router = express.Router()
const CreateProject = z.object({ name: z.string().min(1).max(120) })

router.get('/projects', requireAuth, asyncHandler(async (req, res) => {
  res.json({ data: await db.any('SELECT * FROM projects WHERE user_id = $1', [req.user.id]) })
}))

router.post('/projects', requireAuth, validate({ body: CreateProject }), asyncHandler(async (req, res) => {
  const row = await db.one('INSERT INTO projects (name, user_id) VALUES ($1, $2) RETURNING *', [req.body.name, req.user.id])
  res.status(201).json({ data: row })
}))

module.exports = router
```

```js
// server/src/routes/@custom/index.js  (append)
try { router.use(require('../../api/@custom/projects')) } catch (e) { console.error('[custom] projects route failed to load:', e.message) }
```

To **override** a `@system` endpoint, declare the same method and path (for example `router.get('/user/me', ...)`); the `@custom` handler runs first and `@system` never sees the request. `server/test/api/@system/route-override.test.js` proves the precedence.

Zero-boilerplate alternative: `createCrudRouter({ repo, config: { basePath: '/projects', dataKey: 'project' } })` from `server/src/lib/@system/Helpers` (see `Helpers/README.md`).

## 2. Repository

```js
// server/src/db/repos/@custom/ProjectRepo.js
const db = require('../../../lib/@system/PostgreSQL')
module.exports = {
  findById: (id) => db.oneOrNone('SELECT * FROM projects WHERE id = $1', [id]),
  listForUser: (userId) => db.any('SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
}
```

```js
// server/src/db/repos/@custom/index.js
module.exports = { TenantRepo: require('./TenantRepo'), ProjectRepo: require('./ProjectRepo') }
```

## 3. Migration

```bash
cd server && npm run migrate:create -- create_projects     # writes src/db/migrations/@custom/NNN_create_projects.js
```

```js
'use strict'
exports.up = async (db) => {
  await db.none(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`)
}
exports.down = async (db) => { await db.none('DROP TABLE IF EXISTS projects CASCADE') }
```

`npm run migrate` applies `@system/*.js` first, then `@custom/*.js` (lexicographic within each) and records names in `schema_migrations`. Details: `docs/MIGRATIONS.md`.

## 4. Client page + route

```jsx
// client/src/app/pages/app/@custom/ProjectsPage/index.jsx
import { useEffect, useState } from 'react'
import { api } from '@/app/lib/@system/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/@system/ui/card'

export function ProjectsPage() {
  const [projects, setProjects] = useState([])
  useEffect(() => { api.get('/projects').then((r) => setProjects(r.data ?? [])) }, [])
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold text-brand-text">Projects</h1>
      {projects.map((p) => (
        <Card key={p.id}><CardHeader><CardTitle>{p.name}</CardTitle></CardHeader><CardContent className="text-brand-text-muted">#{p.id}</CardContent></Card>
      ))}
    </div>
  )
}
export default ProjectsPage
```

```jsx
// client/src/app/routes/@custom/index.jsx
import { lazy } from 'react'
import { ProtectedRoute } from '../../components/@system/ProtectedRoute'

const ProjectsPage = lazy(() => import('../../pages/app/@custom/ProjectsPage').then((m) => ({ default: m.ProjectsPage })))

export const customRoutes = [
  { path: '/app/projects', element: <ProtectedRoute><ProjectsPage /></ProtectedRoute> },
]
```

Merge point: `mergeRoutes(systemRoutes, customRoutes)` in `client/src/app/routes/@system/utils.js` keys by `path`, so `{ path: '/pricing', element: <MyPricing /> }` replaces the `@system` pricing page. Build the element inside the route object (Terser removes render-time conditional wrapping).

Sidebar entry (the sidebar reads the registry; routes do not):

```js
// client/src/app/config/@custom/navigation.js  -> pages array
{ path: '/app/projects', label: 'Projects', icon: 'FolderKanban', sidebar: true, section: 'main', order: 10, requiresAuth: true }
```

## 5. Component (add or shadow)

```jsx
// client/src/app/components/@custom/StatusPill/index.jsx
import { cn } from '@/app/lib/@system/utils'
export function StatusPill({ ok, children, className }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
      ok ? 'bg-[var(--brand-primary-10)] text-brand-primary' : 'bg-muted text-muted-foreground', className)}>
      {children}
    </span>
  )
}
```

```jsx
// client/src/app/components/@custom/index.jsx
export { LoadingSpinner } from './LoadingSpinner'
export { StatusPill } from './StatusPill'
```

Merge point: `client/src/app/components/index.js` does `export * from './@system'` then `export * from './@custom'`; exporting a component with the same name as a `@system` one (for example `Footer`) shadows it for everyone importing from the barrel. Direct imports (`@/app/components/@system/Footer`) are not affected.

## 6. UI text (strings)

```js
// client/src/config/@custom/text/index.js
export const text = {
  landing: { hero: { title: 'Ship projects, not spreadsheets', cta: 'Start free' } },
  pricing: { title: 'Plans that scale with you' },
}
```

Merge point: `client/src/config/index.js` deep-merges over `@system/text`; only the keys you set change. Read with `import { text } from '@/config'`. The same pattern exists at `client/src/app/config/{@system,@custom}/text` with resolver `client/src/app/config/text/index.js`.

## 7. Page content modules

```js
// client/src/app/content/@custom/landing.js
export default { heroTitle: 'Projects your team actually finishes', ctaButton: 'Create a project' }
```

Merge point: `loadContent('landing')` in `client/src/app/lib/@system/content.js` imports `content/@system/landing.js` then `content/@custom/landing.js` and spreads the latter over the former. In components use `const content = useContent('landing')` (`hooks/@system/useContent.js`). Keys available by default: see `content/@system/{landing,pricing,auth}.js`.

## 8. Identity config

`client/src/config/@custom/info.js` is generated from `brand.json` by `scripts/apply-brand.js`; change `companyName`, `tagline`, `description`, `primaryColor`, `accentColor`, `defaultTheme`, logo paths there and run `npm run apply-brand`. For fields with no `brand.json` key (for example `plans` for `isRouteLocked`, `social`, `companyAddress`) set them in `brand.json` if a key exists, otherwise in the generated file knowing the next build regenerates it (see `docs/BRANDING.md`).

## 9. Style tokens and CSS

- Colours, fonts, theme: `brand.json` -> `npm run apply-brand` (regenerates `styles/@custom/brand.css`).
- Extra variables: `customCssVars` in `brand.json`.
- Anything else: `client/src/app/styles/@custom/general.css` (imported last by `client/src/index.css`).

```css
/* client/src/app/styles/@custom/general.css */
.project-card { box-shadow: var(--shadow-card); border: 1px solid var(--brand-border-subtle); }
```

## 10. Scheduled task

```js
// server/src/scheduler/tasks/@custom/nightlyProjectDigest.js
'use strict'
const { BaseTask } = require('../@system')
const db = require('../../../lib/@system/PostgreSQL')

class NightlyProjectDigestTask extends BaseTask {
  constructor() { super('nightly-project-digest') }         // unique name, recorded in scheduled_task_runs
  getSchedule() { return '0 2 * * *' }                       // node-cron expression
  async execute() {
    const { count } = await db.one('SELECT count(*)::int AS count FROM projects WHERE created_at > now() - interval \'1 day\'')
    console.log(`[nightly-project-digest] ${count} new projects`)
  }
}
module.exports = NightlyProjectDigestTask
```

```js
// server/src/scheduler/tasks/@custom/index.js
module.exports = { NightlyProjectDigestTask: require('./nightlyProjectDigest') }

// server/src/scheduler/tasks/@custom/init.js
const { NightlyProjectDigestTask } = require('.')
function init(scheduler) { scheduler.registerTask(new NightlyProjectDigestTask()) }
module.exports = init
```

Merge point: `server/src/index.js` calls `require('./scheduler/tasks/@custom/init')(scheduler)` at boot. Pass `true` as the second `super()` argument to run in parallel with the sequential queue.

## 11. Background worker

```js
// server/src/workers/@custom/thumbnailWorker.js
const { Worker } = require('bullmq')
const { client: connection } = require('../../lib/@system/Redis')
module.exports = function startThumbnailWorker() {
  return new Worker('thumbnails', async (job) => { /* ... */ }, { connection })
}
```

```js
// server/src/workers/@custom/index.js
module.exports = { startThumbnailWorker: require('./thumbnailWorker') }
```

Merge point: `server/src/workers/@custom/index.js` is the product barrel; start workers from `server/src/scheduler/tasks/@custom/init.js` or a dedicated boot hook so they only run when Redis is configured. `lib/@system/EmailQueue` is the in-tree reference implementation of a BullMQ queue + worker pair.

## 12. Required environment variable

```js
// server/src/lib/@custom/Env/index.js  -> REQUIRED_VARS
{ key: 'PROJECTS_WEBHOOK_SECRET', description: 'HMAC secret for inbound project webhooks', envs: ['production'] },
```

Add the same key with a placeholder to `server/.env.example`. The server exits at boot with a clear list if a required var is missing in the listed environments.

## 13. Tests for your override

- Unit: `server/test/unit/@custom/ProjectRepo.test.js` (Jest, mock `lib/@system/PostgreSQL`).
- API: `server/test/api/@custom/projects.test.js` (supertest against `require('../../../src/app')`; see `server/test/api/@custom/dashboard.test.js`).
- Client: `client/src/test/@custom/ProjectsPage.test.jsx` (Testing Library; mock `@/app/lib/@system/api`).
- E2E: `e2e/@custom/projects.spec.js` (Playwright).

## 14. Things that are not override seams

- `@system` barrels (`*/@system/index.js`) are generated by `scripts/@system/generate-barrels.js`; do not edit them.
- `client/src/app/routes/@system/manifest.json` is copied into the image as `/app/route-manifest.json` for SEO; add routes through `customRoutes`, not by editing it.
- `server/src/api/@custom/TEMPLATE.js` and `api/@custom/templates/*` are reference scaffolds, not mounted routes. Note they show absolute `/api/...` paths; use paths relative to `/api` as in section 1.
