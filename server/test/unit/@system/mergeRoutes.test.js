/**
 * Unit tests for routes/@system/mergeRoutes.js
 *
 * @system route-merge contract: `mergeRoutes(systemRouter, customRouter)` returns a
 * router that mounts the @custom router BEFORE the @system router so that on any path
 * collision the @custom handler wins (product override), while @system-only paths still
 * fall through to the @system handler.
 */

const express = require('express')
const request = require('supertest')

const { mergeRoutes } = require('../../../src/routes/@system/mergeRoutes')

function makeRouter({ routePath, handler }) {
  const router = express.Router()
  router.get(routePath, (_req, res) => res.json(handler))
  return router
}

const systemHandler = { origin: '@system', value: 'system-value' }
const customHandler = { origin: '@custom', value: 'custom-value' }

let app

beforeEach(() => {
  const systemRouter = express.Router()
  // A path that the @custom router ALSO defines (collision to override)
  systemRouter.use(makeRouter({ routePath: '/widget', handler: systemHandler }))
  // A path that only @system defines (must still be served after custom is mounted)
  systemRouter.use(makeRouter({ routePath: '/system-only', handler: systemHandler }))

  const customRouter = express.Router()
  customRouter.use(makeRouter({ routePath: '/widget', handler: customHandler }))
  // A path only the @custom router defines
  customRouter.use(makeRouter({ routePath: '/custom-only', handler: customHandler }))

  app = express()
  app.use('/api', mergeRoutes(systemRouter, customRouter))
  app.use((_req, res) => res.status(404).json({ message: 'Not found' }))
})

describe('mergeRoutes', () => {
  it('resolves a colliding path to the @custom handler (custom mounted first)', async () => {
    const res = await request(app).get('/api/widget')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(customHandler)
    expect(res.body.origin).toBe('@custom')
  })

  it('still serves paths that only @system defines (fall-through)', async () => {
    const res = await request(app).get('/api/system-only')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(systemHandler)
  })

  it('serves paths that only @custom defines', async () => {
    const res = await request(app).get('/api/custom-only')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(customHandler)
  })

  it('returns 404 for paths no router defines', async () => {
    const res = await request(app).get('/api/does-not-exist')
    expect(res.status).toBe(404)
  })

  it('tolerates a missing @custom router (system only)', async () => {
    const systemOnly = express.Router()
    systemOnly.get('/foo', (_req, res) => res.json({ ok: true }))
    app = express()
    app.use('/api', mergeRoutes(systemOnly, null))
    app.use((_req, res) => res.status(404).json({ message: 'Not found' }))

    const res = await request(app).get('/api/foo')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })
})
