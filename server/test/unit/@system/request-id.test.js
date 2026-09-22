'use strict'

// Unit tests for the @system requestId middleware.

const requestId = require('../../../src/lib/@system/Middleware/requestId')
const { resolveRequestId, HEADER } = requestId

function run(headers = {}) {
  const req = { headers }
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v } }
  const next = jest.fn()
  requestId(req, res, next)
  return { req, res, next }
}

describe('requestId middleware', () => {
  it('reuses a well-formed incoming X-Request-Id', () => {
    const { req, res, next } = run({ 'x-request-id': 'edge-abc.123:456' })
    expect(req.id).toBe('edge-abc.123:456')
    expect(res.headers[HEADER]).toBe('edge-abc.123:456')
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('mints a UUID when the header is missing', () => {
    const { req, res } = run({})
    expect(req.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(res.headers[HEADER]).toBe(req.id)
  })

  it('ignores unsafe incoming ids (CRLF, spaces, too long)', () => {
    for (const bad of ['a\r\nSet-Cookie: x', 'has space', 'x'.repeat(200), '']) {
      expect(resolveRequestId({ headers: { 'x-request-id': bad } })).not.toBe(bad)
    }
  })

  it('ignores array-valued headers', () => {
    const id = resolveRequestId({ headers: { 'x-request-id': ['a', 'b'] } })
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
  })
})
