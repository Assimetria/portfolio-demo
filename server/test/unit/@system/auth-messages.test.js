'use strict'

/**
 * Unit tests for auth middleware user-friendly error messages.
 * Verifies requireAdmin and requireOwnerOrAdmin return clear, descriptive messages.
 */

jest.mock('../../../src/lib/@system/PostgreSQL', () => ({
  one: jest.fn(),
  oneOrNone: jest.fn(),
  none: jest.fn(),
  any: jest.fn(),
}))

jest.mock('../../../src/lib/@system/Redis', () => ({
  client: {
    get: jest.fn(async () => null),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(async () => 0),
    incr: jest.fn(async () => 1),
    expire: jest.fn(),
    ttl: jest.fn(async () => -1),
  },
  isReady: () => false,
}))

const { requireAdmin, requireOwnerOrAdmin } = require('../../../src/lib/@system/Helpers/auth')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

describe('requireAdmin', () => {
  it('returns 403 with a user-friendly message when user is not admin', () => {
    const req = { user: { id: 1, role: 'user' } }
    const res = mockRes()
    const next = jest.fn()

    requireAdmin(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({
      message: 'You need admin privileges to access this area.',
    })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 403 with a user-friendly message when user is missing', () => {
    const req = {}
    const res = mockRes()
    const next = jest.fn()

    requireAdmin(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({
      message: 'You need admin privileges to access this area.',
    })
  })

  it('calls next() when user has admin role', () => {
    const req = { user: { id: 1, role: 'admin' } }
    const res = mockRes()
    const next = jest.fn()

    requireAdmin(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })
})

describe('requireOwnerOrAdmin', () => {
  it('returns 403 with a user-friendly message when user is not the owner', async () => {
    const req = { user: { id: 2, role: 'user' } }
    const res = mockRes()
    const next = jest.fn()

    const middleware = requireOwnerOrAdmin(async () => 1) // owner is user 1
    await middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({
      message: "You don't have permission to modify this resource.",
    })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 404 with a user-friendly message when resource is not found', async () => {
    const req = { user: { id: 1, role: 'user' } }
    const res = mockRes()
    const next = jest.fn()

    const middleware = requireOwnerOrAdmin(async () => null)
    await middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({
      message: 'The requested resource could not be found.',
    })
  })

  it('calls next() when user is the owner', async () => {
    const req = { user: { id: 1, role: 'user' } }
    const res = mockRes()
    const next = jest.fn()

    const middleware = requireOwnerOrAdmin(async () => 1)
    await middleware(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('calls next() when user is admin regardless of ownership', async () => {
    const req = { user: { id: 99, role: 'admin' } }
    const res = mockRes()
    const next = jest.fn()

    const middleware = requireOwnerOrAdmin(async () => 1) // owner is user 1
    await middleware(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('returns 401 when user is missing', async () => {
    const req = {}
    const res = mockRes()
    const next = jest.fn()

    const middleware = requireOwnerOrAdmin(async () => 1)
    await middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})
