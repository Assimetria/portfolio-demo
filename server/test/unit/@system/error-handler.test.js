'use strict'

// Unit tests for the final @system error handler: generic 5xx bodies in
// production, pass-through 4xx messages, request id on every response,
// special-cased parser / DB / Stripe errors.

const { createErrorHandler, GENERIC_5XX, redactPaths, normaliseStatus } = require('../../../src/lib/@system/Middleware/errorHandler')

function mockLogger() {
  return { error: jest.fn(), warn: jest.fn(), info: jest.fn() }
}

function mockRes() {
  const res = { headersSent: false, statusCode: null, body: null }
  res.status = jest.fn((code) => { res.statusCode = code; return res })
  res.json = jest.fn((body) => { res.body = body; return res })
  return res
}

const req = { id: 'req-1', method: 'GET', url: '/api/x', originalUrl: '/api/x', ip: '1.2.3.4' }

describe('errorHandler — production', () => {
  const logger = mockLogger()
  const handler = createErrorHandler({ logger, isProd: true })

  beforeEach(() => jest.clearAllMocks())

  it('hides internal 5xx messages and includes the request id', () => {
    const res = mockRes()
    handler(new Error('relation "users" does not exist at /Users/x/app.js'), req, res, jest.fn())
    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: GENERIC_5XX, requestId: 'req-1' })
    expect(logger.error).toHaveBeenCalledTimes(1)
    const [payload] = logger.error.mock.calls[0]
    expect(payload.requestId).toBe('req-1')
    expect(payload.err.stack).toBeDefined()
  })

  it('treats a non-numeric / out-of-range status as 500', () => {
    expect(normaliseStatus({ status: 'abc' })).toBe(500)
    expect(normaliseStatus({ status: 200 })).toBe(500)
    expect(normaliseStatus({ statusCode: 404 })).toBe(404)
  })

  it('passes 4xx messages through and logs at warn level', () => {
    const res = mockRes()
    const err = Object.assign(new Error('Email already in use'), { status: 409, code: 'EMAIL_TAKEN' })
    handler(err, req, res, jest.fn())
    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ message: 'Email already in use', code: 'EMAIL_TAKEN', requestId: 'req-1' })
    expect(logger.warn).toHaveBeenCalledTimes(1)
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('never forwards driver-style codes on 4xx', () => {
    const res = mockRes()
    handler(Object.assign(new Error('dup'), { status: 409, code: '23505' }), req, res, jest.fn())
    expect(res.body.code).toBeUndefined()
  })

  it('forwards a structured errors array on 4xx', () => {
    const res = mockRes()
    const err = Object.assign(new Error('Validation failed'), { status: 400, errors: [{ field: 'body.email', message: 'invalid' }] })
    handler(err, req, res, jest.fn())
    expect(res.body.errors).toHaveLength(1)
  })

  it('maps JSON parse errors to a safe 400', () => {
    const res = mockRes()
    handler(Object.assign(new SyntaxError('Unexpected token } in JSON at position 12'), { status: 400, type: 'entity.parse.failed', body: '{' }), req, res, jest.fn())
    expect(res.statusCode).toBe(400)
    expect(res.body.message).toBe('Invalid JSON in request body')
    expect(res.body.requestId).toBe('req-1')
  })

  it('maps oversized bodies to 413', () => {
    const res = mockRes()
    handler(Object.assign(new Error('request entity too large'), { status: 413, type: 'entity.too.large' }), req, res, jest.fn())
    expect(res.statusCode).toBe(413)
  })

  it('maps DB connection timeouts to 503', () => {
    const res = mockRes()
    handler(new Error('Connection terminated unexpectedly'), req, res, jest.fn())
    expect(res.statusCode).toBe(503)
    expect(res.body.code).toBe('DB_UNAVAILABLE')
  })

  it('never exposes raw Stripe error text except card declines', () => {
    const res1 = mockRes()
    handler(Object.assign(new Error('No such price: price_123'), { type: 'StripeInvalidRequestError', statusCode: 400 }), req, res1, jest.fn())
    expect(res1.body.message).not.toMatch(/price_123/)

    const res2 = mockRes()
    handler(Object.assign(new Error('Your card has insufficient funds.'), { type: 'StripeCardError', statusCode: 402 }), req, res2, jest.fn())
    expect(res2.statusCode).toBe(402)
    expect(res2.body.message).toBe('Your card has insufficient funds.')

    const res3 = mockRes()
    handler(Object.assign(new Error('Invalid API Key provided: sk_live_***'), { type: 'StripeAuthenticationError' }), req, res3, jest.fn())
    expect(res3.statusCode).toBe(500)
    expect(res3.body.message).not.toMatch(/sk_live/)
  })

  it('does not try to respond when headers were already sent', () => {
    const res = mockRes()
    res.headersSent = true
    handler(new Error('boom'), req, res, jest.fn())
    expect(res.status).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledTimes(1)
  })
})

describe('errorHandler — development', () => {
  it('keeps the real 5xx message but redacts filesystem paths', () => {
    const handler = createErrorHandler({ logger: mockLogger(), isProd: false })
    const res = mockRes()
    handler(new Error('ENOENT: open /Users/dev/app/secret.json'), req, res, jest.fn())
    expect(res.statusCode).toBe(500)
    expect(res.body.message).toBe('ENOENT: open [path]')
    expect(res.body.requestId).toBe('req-1')
  })

  it('redactPaths handles common roots', () => {
    expect(redactPaths('at /home/ubuntu/x/y.js:1')).toBe('at [path]')
    expect(redactPaths('at /app/server/src/index.js')).toBe('at [path]')
    expect(redactPaths('no paths here')).toBe('no paths here')
  })
})
