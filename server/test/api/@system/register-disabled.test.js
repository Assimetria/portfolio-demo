/**
 * API tests — self-registration switched off (brand.json modules.selfRegistration=false,
 * which is the informational template's default).
 *
 * All three public account-creation endpoints must answer 403 with the
 * MODULE_DISABLED code BEFORE touching CSRF, rate limits or the database, while
 * login on the very same router keeps working. The DB is mocked so this runs
 * without services.
 */

const request = require('supertest')

jest.mock('../../../src/lib/@system/PostgreSQL', () => ({
  one: jest.fn(), oneOrNone: jest.fn().mockResolvedValue(null), none: jest.fn(), any: jest.fn().mockResolvedValue([]),
  many: jest.fn(), manyOrNone: jest.fn(), query: jest.fn(), tx: jest.fn(async (fn) => fn({})), result: jest.fn(),
  $pool: { end: jest.fn() },
}))
jest.mock('../../../src/lib/@system/Redis', () => ({
  client: { get: jest.fn(), set: jest.fn(), del: jest.fn(), exists: jest.fn(), incr: jest.fn(), expire: jest.fn(), ttl: jest.fn() },
  isReady: () => false,
}))

// Force the module off regardless of the brand.json this test runs against.
process.env.MODULES_JSON = JSON.stringify({ selfRegistration: false })
const app = require('../../../src/app')
const { SELF_REGISTRATION_DISABLED_MESSAGE } = require('../../../src/lib/@system/Helpers/modules')

const body = { email: 'new@example.com', password: 'CorrectHorse!Battery9', name: 'New User' }

describe('self-registration disabled', () => {
  it.each(['/api/auth/register', '/api/sessions/register', '/api/users'])('POST %s → 403 MODULE_DISABLED', async (p) => {
    const res = await request(app).post(p).send(body)
    expect(res.status).toBe(403)
    expect(res.body).toEqual(expect.objectContaining({
      code: 'MODULE_DISABLED',
      module: 'selfRegistration',
      message: SELF_REGISTRATION_DISABLED_MESSAGE,
    }))
  })

  it('does not gate login on the same router (CSRF check runs, i.e. not 403 MODULE_DISABLED)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.co', password: 'x' })
    expect(res.body.code).not.toBe('MODULE_DISABLED')
  })

  it('does not gate the admin provisioning endpoint (CSRF/auth run instead of MODULE_DISABLED)', async () => {
    const res = await request(app).post('/api/users/provision').send({ email: 'p@example.com' })
    expect(res.body.code).not.toBe('MODULE_DISABLED')
  })
})

afterAll(() => { delete process.env.MODULES_JSON })
