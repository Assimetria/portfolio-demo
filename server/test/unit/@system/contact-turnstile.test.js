/**
 * Unit tests — Cloudflare Turnstile verification (api/@system/contact/turnstile.js).
 * fetch is injected so no network is touched.
 */

jest.mock('../../../src/lib/@system/Logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))

const { verifyTurnstile, SITEVERIFY_URL } = require('../../../src/api/@system/contact/turnstile')

function fakeFetch(status, json) {
  return jest.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => json }))
}

describe('verifyTurnstile', () => {
  it('reports not_configured without a secret and never calls fetch', async () => {
    const fetchImpl = fakeFetch(200, { success: true })
    expect(await verifyTurnstile('tok', { fetchImpl })).toEqual({ ok: false, reason: 'not_configured' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports missing_token for empty/non-string tokens without calling fetch', async () => {
    const fetchImpl = fakeFetch(200, { success: true })
    expect(await verifyTurnstile('', { secretKey: 's', fetchImpl })).toEqual({ ok: false, reason: 'missing_token' })
    expect(await verifyTurnstile(undefined, { secretKey: 's', fetchImpl })).toEqual({ ok: false, reason: 'missing_token' })
    expect(await verifyTurnstile(42, { secretKey: 's', fetchImpl })).toEqual({ ok: false, reason: 'missing_token' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('POSTs secret, response and remoteip as a form body to siteverify', async () => {
    const fetchImpl = fakeFetch(200, { success: true })
    const result = await verifyTurnstile('tok-123', { secretKey: 'shh', remoteIp: '203.0.113.9', fetchImpl })
    expect(result).toEqual({ ok: true })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(SITEVERIFY_URL)
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    const params = new URLSearchParams(init.body)
    expect(params.get('secret')).toBe('shh')
    expect(params.get('response')).toBe('tok-123')
    expect(params.get('remoteip')).toBe('203.0.113.9')
  })

  it('omits remoteip when not provided', async () => {
    const fetchImpl = fakeFetch(200, { success: true })
    await verifyTurnstile('tok', { secretKey: 'shh', fetchImpl })
    expect(new URLSearchParams(fetchImpl.mock.calls[0][1].body).has('remoteip')).toBe(false)
  })

  it('returns invalid + error codes when Cloudflare rejects the token', async () => {
    const fetchImpl = fakeFetch(200, { success: false, 'error-codes': ['invalid-input-response'] })
    expect(await verifyTurnstile('bad', { secretKey: 'shh', fetchImpl })).toEqual({
      ok: false,
      reason: 'invalid',
      errorCodes: ['invalid-input-response'],
    })
  })

  it('returns unavailable on non-2xx responses', async () => {
    const fetchImpl = fakeFetch(502, {})
    expect(await verifyTurnstile('tok', { secretKey: 'shh', fetchImpl })).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('returns unavailable when fetch throws (network / timeout)', async () => {
    const fetchImpl = jest.fn(async () => { throw new Error('ECONNRESET') })
    expect(await verifyTurnstile('tok', { secretKey: 'shh', fetchImpl })).toEqual({ ok: false, reason: 'unavailable' })
  })
})
