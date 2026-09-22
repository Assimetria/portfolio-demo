/**
 * Unit tests — the CSRF exemption for API-key requests must not be usable as a bypass.
 *
 * csrfProtection runs before route-level authenticate(), so it cannot validate the key. The
 * guarantee it gives instead: a request that presents API-key credentials is stripped of every
 * ambient (cookie) credential before it continues, so a forged X-API-Key header can never make a
 * cross-site request execute as the logged-in victim.
 *
 * NODE_ENV is flipped to 'development' per call because csrfProtection short-circuits under test.
 */

process.env.CSRF_SECRET = process.env.CSRF_SECRET || 'unit-test-csrf-secret-at-least-32-chars-long'
const { csrfProtection, requireCsrfPresence, stripAmbientCredentials, isApiKeyRequest } = require('../../../src/lib/@system/Middleware/csrf')

function makeReq({ method = 'POST', headers = {}, cookies = {} } = {}) {
  return {
    method,
    path: '/api/shop/cart/items',
    originalUrl: '/api/shop/cart/items',
    headers: { cookie: 'access_token=victim-jwt; refresh_token=victim-rt', ...headers },
    cookies: { access_token: 'victim-jwt', refresh_token: 'victim-rt', ...cookies },
    signedCookies: {},
  }
}

function makeRes() {
  const res = { statusCode: 200, body: null }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (body) => { res.body = body; return res }
  return res
}

function runInDev(fn) {
  const prev = process.env.NODE_ENV
  process.env.NODE_ENV = 'development'
  try { return fn() } finally { process.env.NODE_ENV = prev }
}

describe('isApiKeyRequest', () => {
  it('detects X-API-Key and Bearer sk_ tokens, not JWTs', () => {
    expect(isApiKeyRequest(makeReq({ headers: { 'x-api-key': 'anything' } }))).toBe(true)
    expect(isApiKeyRequest(makeReq({ headers: { authorization: 'Bearer sk_live_123' } }))).toBe(true)
    expect(isApiKeyRequest(makeReq({ headers: { authorization: 'Bearer eyJhbGciOi.eyJzdWIi.sig' } }))).toBe(false)
    expect(isApiKeyRequest(makeReq())).toBe(false)
  })
})

describe('stripAmbientCredentials', () => {
  it('removes parsed cookies, signed cookies and the raw Cookie header', () => {
    const req = makeReq({ cookies: { 'psifi.x-csrf-token': 'x' } })
    req.signedCookies = { s: '1' }
    stripAmbientCredentials(req)
    expect(req.cookies).toEqual({})
    expect(req.signedCookies).toEqual({})
    expect(req.headers.cookie).toBeUndefined()
  })
})

describe('csrfProtection with an API-key header (development mode)', () => {
  it('lets the request through WITHOUT the victim cookies — a forged key cannot ride the session', () => {
    const req = makeReq({ headers: { 'x-api-key': 'forged-by-attacker' } })
    const res = makeRes()
    const next = jest.fn()
    runInDev(() => csrfProtection(req, res, next))
    expect(next).toHaveBeenCalledTimes(1)
    expect(res.body).toBeNull()
    expect(req.cookies).toEqual({})
    expect(req.headers.cookie).toBeUndefined()
  })

  it('does the same for Bearer sk_ keys', () => {
    const req = makeReq({ headers: { authorization: 'Bearer sk_test_abc' } })
    const next = jest.fn()
    runInDev(() => csrfProtection(req, makeRes(), next))
    expect(next).toHaveBeenCalledTimes(1)
    expect(req.cookies.access_token).toBeUndefined()
  })

  it('still rejects a cookie-bearing POST without a CSRF token (no API key → no exemption)', () => {
    const req = makeReq()
    const res = makeRes()
    const next = jest.fn()
    runInDev(() => csrfProtection(req, res, next))
    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(403)
    expect(res.body.error).toBe('CSRF_VALIDATION_FAILED')
    // Cookies are untouched for browser requests.
    expect(req.cookies.access_token).toBe('victim-jwt')
  })

  it('a Bearer JWT (session-style) does not earn the exemption', () => {
    const req = makeReq({ headers: { authorization: 'Bearer eyJhbGciOi.eyJzdWIi.sig' } })
    const res = makeRes()
    const next = jest.fn()
    runInDev(() => csrfProtection(req, res, next))
    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(403)
  })

  it('safe methods pass regardless and keep their cookies', () => {
    const req = makeReq({ method: 'GET' })
    const next = jest.fn()
    runInDev(() => csrfProtection(req, makeRes(), next))
    expect(next).toHaveBeenCalledTimes(1)
    expect(req.cookies.access_token).toBe('victim-jwt')
  })
})

describe('requireCsrfPresence mirrors the rule', () => {
  it('API-key requests pass only once stripped of cookies', () => {
    const req = makeReq({ headers: { 'x-api-key': 'k' } })
    const next = jest.fn()
    runInDev(() => requireCsrfPresence(req, makeRes(), next))
    expect(next).toHaveBeenCalledTimes(1)
    expect(req.cookies).toEqual({})
  })

  it('browser POST without token + cookie → 403', () => {
    const res = makeRes()
    const next = jest.fn()
    runInDev(() => requireCsrfPresence(makeReq(), res, next))
    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(403)
  })
})
