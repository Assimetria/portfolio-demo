/**
 * API-level contract tests for the @custom-over-@system route override
 * (task #1024401 criterion #5).
 *
 * `server/src/app.js` wires `app.use('/api', mergeRoutes(systemRoutes, customRoutes))`
 * with the @custom router mounted FIRST. This suite drives the real mergeRoutes helper
 * through HTTP so that on a path collision the @custom handler wins while @system
 * endpoints that @custom does not define still resolve.
 *
 * These use stub @system/@custom routers so no DB / Redis / email deps are required.
 */

const express = require('express')
const request = require('supertest')

const { mergeRoutes } = require('../../../src/routes/@system/mergeRoutes')

// Mirrors how @custom/@system modules expose bare express.Router instances
function buildCustomRouter() {
  const router = express.Router()
  router.get('/widget', (_req, res) => res.json({ origin: '@custom', route: '/widget' }))
  return router
}

function buildSystemRouter() {
  const router = express.Router()
  // Path collision the @custom router overrides
  router.get('/widget', (_req, res) => res.json({ origin: '@system', route: '/widget' }))
  // Paths only @system defines
  router.get('/system-resource', (_req, res) => res.json({ origin: '@system', route: '/system-resource' }))
  return router
}

describe('GET /api route override (custom-first merge)', () => {
  it('resolves the colliding /api/widget path to the @custom handler', async () => {
    const app = express()
    app.use('/api', mergeRoutes(buildSystemRouter(), buildCustomRouter()))
    app.use((_req, res) => res.status(404).json({ message: 'Not found' }))

    const res = await request(app).get('/api/widget')
    expect(res.status).toBe(200)
    expect(res.body.origin).toBe('@custom')
  })

  it('still serves @system-only paths that @custom does not define', async () => {
    const app = express()
    app.use('/api', mergeRoutes(buildSystemRouter(), buildCustomRouter()))
    app.use((_req, res) => res.status(404).json({ message: 'Not found' }))

    const res = await request(app).get('/api/system-resource')
    expect(res.status).toBe(200)
    expect(res.body.origin).toBe('@system')
  })

  it('falls through to 404 when neither router defines the path', async () => {
    const app = express()
    app.use('/api', mergeRoutes(buildSystemRouter(), buildCustomRouter()))
    app.use((_req, res) => res.status(404).json({ message: 'Not found' }))

    const res = await request(app).get('/api/does-not-exist')
    expect(res.status).toBe(404)
  })
})
