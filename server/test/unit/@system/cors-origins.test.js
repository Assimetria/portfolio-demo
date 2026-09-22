'use strict'

// Unit tests for the @system CORS allow-list: localhost origins are dev-only.

const CORS_MODULE = '../../../src/lib/@system/Middleware/cors'

function loadWithEnv(env) {
  const prev = process.env
  process.env = { ...prev, ...env }
  let mod
  try {
    jest.isolateModules(() => {
      mod = require(CORS_MODULE)
    })
  } finally {
    process.env = prev
  }
  return mod
}

describe('CORS allow-list', () => {
  it('includes localhost origins outside production', () => {
    const cors = loadWithEnv({ NODE_ENV: 'development', APP_URL: 'https://app.example.com' })
    expect(cors.ALLOWED_ORIGINS).toEqual(expect.arrayContaining(['https://app.example.com', 'http://localhost:5173']))
    expect(cors.isOriginAllowed('http://localhost:5173')).toBe(true)
  })

  it('excludes localhost origins in production', () => {
    const cors = loadWithEnv({ NODE_ENV: 'production', APP_URL: 'https://app.example.com', CORS_ORIGINS: 'https://staging.example.com, https://b.example.com' })
    expect(cors.ALLOWED_ORIGINS).toEqual(['https://app.example.com', 'https://staging.example.com', 'https://b.example.com'])
    expect(cors.isOriginAllowed('http://localhost:5173')).toBe(false)
    expect(cors.isOriginAllowed('http://localhost:3000')).toBe(false)
    expect(cors.isOriginAllowed('https://staging.example.com')).toBe(true)
  })

  it('allows requests with no Origin header (non-browser / same-origin)', () => {
    const cors = loadWithEnv({ NODE_ENV: 'production', APP_URL: 'https://app.example.com' })
    expect(cors.isOriginAllowed(undefined)).toBe(true)
    expect(cors.isOriginAllowed('undefined')).toBe(true)
  })

  it('rejects unknown origins with a 403 that does not echo the origin', () => {
    const cors = loadWithEnv({ NODE_ENV: 'production', APP_URL: 'https://app.example.com' })
    const req = { headers: { origin: 'https://evil.example' }, method: 'GET' }
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
    const next = jest.fn()
    cors(req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toMatch(/evil\.example/)
    expect(next).not.toHaveBeenCalled()
  })
})
