/**
 * Route barrel ↔ feature modules.
 *
 * server/src/routes/@system/index.js (generated) mounts each @system router
 * through `mount(name, path)`, which asks Helpers/modules.isRouterEnabled().
 * With billing off, /api/stripe/* must not exist at all (404 from the app's
 * fallthrough), while the always-on routers (ping, auth) are still served.
 * With billing on (MODULES_JSON override), the Stripe router answers.
 *
 * DB/Redis are mocked; the barrel is re-required per scenario with
 * jest.isolateModules so the resolver re-reads MODULES_JSON.
 */

const express = require('express')
const request = require('supertest')

jest.mock('../../../src/lib/@system/PostgreSQL', () => ({
  one: jest.fn(), oneOrNone: jest.fn(), none: jest.fn(), any: jest.fn(), many: jest.fn(),
  manyOrNone: jest.fn(), query: jest.fn(), tx: jest.fn(async (fn) => fn({})), result: jest.fn(),
  $pool: { end: jest.fn() },
}))
jest.mock('../../../src/lib/@system/Redis', () => ({
  client: { get: jest.fn(), set: jest.fn(), del: jest.fn(), exists: jest.fn(), incr: jest.fn(), expire: jest.fn(), ttl: jest.fn() },
  isReady: () => false,
}))

const ORIGINAL_ENV = process.env.MODULES_JSON

function buildApp(modulesJson) {
  let barrel
  jest.isolateModules(() => {
    if (modulesJson === undefined) delete process.env.MODULES_JSON
    else process.env.MODULES_JSON = modulesJson
    barrel = require('../../../src/routes/@system')
  })
  const app = express()
  app.use(express.json())
  app.use('/api', barrel)
  app.use((_req, res) => res.status(404).json({ message: 'Not found' }))
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ message: err.message }))
  return app
}

afterAll(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.MODULES_JSON
  else process.env.MODULES_JSON = ORIGINAL_ENV
})

describe('routes/@system barrel with billing OFF (repo brand.json)', () => {
  const app = buildApp(undefined)

  it('does not mount /api/stripe/*, /api/polar/*, /api/subscriptions, /api/payments', async () => {
    for (const p of ['/api/stripe/prices', '/api/polar/products', '/api/subscriptions/me', '/api/payments/provider']) {
      const res = await request(app).get(p)
      expect({ p, status: res.status }).toEqual({ p, status: 404 })
    }
  })

  it('does not mount teams / api-keys / usage / webhooks / ai / onboarding / blog', async () => {
    for (const p of ['/api/teams', '/api/api-keys', '/api/usage/dashboard', '/api/webhooks', '/api/onboarding', '/api/blog', '/api/threads']) {
      const res = await request(app).get(p)
      expect({ p, status: res.status }).toEqual({ p, status: 404 })
    }
  })

  it('still mounts the always-on routers', async () => {
    expect((await request(app).get('/api/ping')).status).toBe(200)
    // auth router is mounted (401 = handler ran), only its register endpoint is gated
    expect((await request(app).get('/api/auth/login')).status).toBe(401)
    expect((await request(app).get('/api/docs.json')).status).toBe(200)
  })
})

describe('routes/@system barrel with billing ON (MODULES_JSON override)', () => {
  const app = buildApp(JSON.stringify({ billing: true }))

  it('mounts the Stripe router (handler answers, i.e. not the 404 fallthrough)', async () => {
    const res = await request(app).get('/api/stripe/prices')
    expect(res.status).not.toBe(404)
  })

  it('leaves the other disabled modules unmounted', async () => {
    expect((await request(app).get('/api/teams')).status).toBe(404)
  })
})
