// @system — lib/@system/api: CSRF token flow on mutations and the ApiError
// contract (status + parsed body + errors[]) that forms rely on.
import { api, ApiError } from '@/app/lib/@system/api'

function jsonResponse(status, body, ok = status >= 200 && status < 300) {
  return { ok, status, statusText: `HTTP ${status}`, json: async () => body }
}

beforeEach(() => {
  global.fetch = jest.fn()
})
afterEach(() => {
  delete global.fetch
})

describe('api client', () => {
  it('fetches the CSRF token before the first mutation and sends it as X-CSRF-Token', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(200, { csrfToken: 'tok-1' })) // GET /api/csrf-token
      .mockResolvedValueOnce(jsonResponse(201, { data: { id: 1 } }))   // POST /api/contact

    const out = await api.post('/contact', { name: 'x' })
    expect(out).toEqual({ data: { id: 1 } })

    const [csrfUrl, csrfInit] = global.fetch.mock.calls[0]
    expect(csrfUrl).toBe('/api/csrf-token')
    expect(csrfInit.credentials).toBe('include')

    const [url, init] = global.fetch.mock.calls[1]
    expect(url).toBe('/api/contact')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(init.headers['X-CSRF-Token']).toBe('tok-1')
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('throws ApiError with status, body and errors[] on 4xx', async () => {
    const body = { message: 'Validation failed', errors: [{ field: 'body.email', message: 'bad' }] }
    global.fetch.mockResolvedValueOnce(jsonResponse(400, body))

    const err = await api.post('/contact', {}).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('Validation failed')
    expect(err.status).toBe(400)
    expect(err.body).toEqual(body)
    expect(err.errors).toEqual(body.errors)
  })

  it('exposes 429 as status with the server message and an empty errors[]', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(429, { message: 'Too many messages' }))
    const err = await api.post('/contact', {}).catch((e) => e)
    expect(err.status).toBe(429)
    expect(err.message).toBe('Too many messages')
    expect(err.errors).toEqual([])
  })

  it('falls back to statusText when the error body is not JSON', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 502, statusText: 'Bad Gateway', json: async () => { throw new Error('not json') } })
    const err = await api.get('/contact').catch((e) => e)
    expect(err.status).toBe(502)
    expect(err.message).toBe('Bad Gateway')
  })

  it('refetches the token and retries once on CSRF_VALIDATION_FAILED', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(403, { error: 'CSRF_VALIDATION_FAILED', message: 'Invalid or missing CSRF token' }))
      .mockResolvedValueOnce(jsonResponse(200, { csrfToken: 'tok-2' }))
      .mockResolvedValueOnce(jsonResponse(201, { data: { id: 2 } }))

    const out = await api.post('/contact', {})
    expect(out).toEqual({ data: { id: 2 } })
    expect(global.fetch.mock.calls[2][1].headers['X-CSRF-Token']).toBe('tok-2')
  })

  it('returns null for 204 responses', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, status: 204, json: async () => { throw new Error('no body') } })
    expect(await api.delete('/contact/1')).toBeNull()
  })
})
