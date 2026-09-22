/**
 * Middleware-structure contract for the @custom-over-@system route merge
 * (task #1024401 critiera #5 / #6).
 *
 * `server/src/app.js` wires the `/api` stack as:
 *   1. /api Cache-Control header guard           (app.js ~L95)
 *   2. apiLimiter baseline DoS protection        (app.js ~L101)
 *   3. attachDatabase  -> req.db                 (app.js ~L104)
 *   4. mergeRoutes(systemRoutes, customRoutes)   (app.js ~L107)
 *
 * The @custom router is mounted FIRST inside that merged router so that on a
 * path collision the @custom handler wins, while @system paths that @custom
 * does not define still fall through. This suite locks down the whole ordering
 * contract: the gateway middlewares that run BEFORE the merge must never
 * short-circuit (swallow) an @custom handler, and any handler reached through
 * the merged router must still observe the upstream gateway side-effects
 * (Cache-Control header + req.db attachment).
 *
 * It mirrors the app.js layering with pure Express + stub routers so it needs
 * no DB / Redis / email dependencies and stays deterministic in CI.
 */

const express = require('express')
const request = require('supertest')

const { mergeRoutes } = require('../../../src/routes/@system/mergeRoutes')

/**
 * Replicates the ordering-sensitive /api middleware batch found in app.js.
 * - cacheControlGuard: sets the response Cache-Control header (app.js L95).
 * - apiLimiterStub: represents the baseline rate limiter — passes requests
 *   through unless a caller flips its "limited" flag (app.js L101).
 * - attachDbStub: attaches a sentinel to req.db like attachDatabase (app.js L104).
 * - Then the merged custom-first router is mounted (app.js L107).
 */
function buildAppRouter({ limited = false, system, custom } = {}) {
  const app = express()
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-cache')
    next()
  })
  app.use('/api', (_req, _res, next) => (limited ? next(Object.assign(new Error('Rate limit exceeded'), { status: 429 })) : next()))
  app.use('/api', (req, _res, next) => {
    req.db = { sentinel: '@system/repositories' }
    next()
  })
  app.use('/api', mergeRoutes(system, custom))
  app.use((_req, res) => res.status(404).json({ message: 'Not found' }))
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => res.status(err.status ?? 500).json({ message: err.message }))
  return app
}

function buildCustomRouter() {
  const router = express.Router()
  router.get('/widget', (req, res) =>
    res.json({ origin: '@custom', route: '/widget', cacheControl: res.getHeader('Cache-Control'), db: req.db?.sentinel ?? null }),
  )
  return router
}

function buildSystemRouter() {
  const router = express.Router()
  router.get('/widget', (_req, res) => res.json({ origin: '@system', route: '/widget' }))
  router.get('/system-resource', (req, res) =>
    res.json({ origin: '@system', route: '/system-resource', cacheControl: res.getHeader('Cache-Control'), db: req.db?.sentinel ?? null }),
  )
  return router
}

describe('GET /api merge + middleware ordering', () => {
  it('resolves a colliding path to @custom while still applying the upstream middleware chain', async () => {
    const app = buildAppRouter({ system: buildSystemRouter(), custom: buildCustomRouter() })

    const res = await request(app).get('/api/widget')

    expect(res.status).toBe(200)
    expect(res.body.origin).toBe('@custom')
    // Gateway middleware set BEFORE the merge must still reach @custom handlers.
    expect(res.headers['cache-control']).toBe('private, no-cache')
    expect(res.body.cacheControl).toBe('private, no-cache')
    expect(res.body.db).toBe('@system/repositories')
  })

  it('still serves @system-only paths with the same upstream middleware applied', async () => {
    const app = buildAppRouter({ system: buildSystemRouter(), custom: buildCustomRouter() })

    const res = await request(app).get('/api/system-resource')

    expect(res.status).toBe(200)
    expect(res.body.origin).toBe('@system')
    expect(res.headers['cache-control']).toBe('private, no-cache')
    expect(res.body.cacheControl).toBe('private, no-cache')
    expect(res.body.db).toBe('@system/repositories')
  })

  it('lets an upstream rate-limit guard legitimately short-circuit before the merged router', async () => {
    const app = buildAppRouter({ limited: true, system: buildSystemRouter(), custom: buildCustomRouter() })

    const res = await request(app).get('/api/widget')

    expect(res.status).toBe(429)
    expect(res.body.message).toBe('Rate limit exceeded')
  })
})
