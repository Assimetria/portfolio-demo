const {
  asyncHandler,
  createNotFoundHandler,
  requireFields,
  parseBooleanParams,
  parseArrayParams,
  parseIntParams,
  extractAllowedFields,
  successResponse,
  errorResponse,
  validateIdParam,
  addTimestamp,
  conditionalMiddleware,
} = require('../../../src/lib/@system/Helpers/api-utils')

const mockRes = () => {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

describe('api-utils', () => {
  describe('asyncHandler', () => {
    it('resolves and calls handler', async () => {
      const handler = jest.fn().mockResolvedValue('ok')
      const next = jest.fn()
      await asyncHandler(handler)({}, {}, next)
      expect(handler).toHaveBeenCalled()
      expect(next).not.toHaveBeenCalled()
    })

    it('passes rejected errors to next()', async () => {
      const err = new Error('boom')
      const handler = jest.fn().mockRejectedValue(err)
      const next = jest.fn()
      await asyncHandler(handler)({}, {}, next)
      expect(next).toHaveBeenCalledWith(err)
    })
  })

  describe('createNotFoundHandler', () => {
    it('returns 404 with resource metadata', () => {
      const res = mockRes()
      const req = { params: { id: '42' } }
      createNotFoundHandler('Project')(req, res)
      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({
        message: 'Project not found',
        resource: 'project',
        id: '42',
      })
    })
  })

  describe('requireFields', () => {
    it('calls next() when all fields present', () => {
      const req = { body: { a: 1, b: 'x' } }
      const next = jest.fn()
      requireFields('a', 'b')(req, mockRes(), next)
      expect(next).toHaveBeenCalled()
    })

    it('returns 400 with missing fields', () => {
      const req = { body: { a: 1, b: '', c: null } }
      const res = mockRes()
      const next = jest.fn()
      requireFields('a', 'b', 'c', 'd')(req, res, next)
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        message: 'Missing required fields',
        missing: ['b', 'c', 'd'],
      })
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('parseBooleanParams', () => {
    it('converts "true"/"false"/"1" strings to booleans', () => {
      const parsed = parseBooleanParams(
        { active: 'true', archived: 'false', pinned: '1', name: 'foo' },
        ['active', 'archived', 'pinned']
      )
      expect(parsed.active).toBe(true)
      expect(parsed.archived).toBe(false)
      expect(parsed.pinned).toBe(true)
      expect(parsed.name).toBe('foo')
    })

    it('leaves fields undefined when not present', () => {
      const parsed = parseBooleanParams({}, ['active'])
      expect(parsed.active).toBeUndefined()
    })
  })

  describe('parseArrayParams', () => {
    it('splits CSV strings and trims', () => {
      const parsed = parseArrayParams({ tags: 'a, b ,c' }, ['tags'])
      expect(parsed.tags).toEqual(['a', 'b', 'c'])
    })

    it('filters empty tokens', () => {
      const parsed = parseArrayParams({ tags: 'a,,b,' }, ['tags'])
      expect(parsed.tags).toEqual(['a', 'b'])
    })

    it('ignores non-string values', () => {
      const parsed = parseArrayParams({ tags: ['already', 'array'] }, ['tags'])
      expect(parsed.tags).toEqual(['already', 'array'])
    })
  })

  describe('parseIntParams', () => {
    it('parses integer strings', () => {
      const parsed = parseIntParams({ page: '3', limit: '20' }, ['page', 'limit'])
      expect(parsed.page).toBe(3)
      expect(parsed.limit).toBe(20)
    })

    it('clamps to min/max range', () => {
      const parsed = parseIntParams({ limit: '1000' }, ['limit'], { min: 1, max: 100 })
      expect(parsed.limit).toBe(100)
      const parsed2 = parseIntParams({ limit: '-5' }, ['limit'], { min: 1, max: 100 })
      expect(parsed2.limit).toBe(1)
    })

    it('leaves NaN values unchanged', () => {
      const parsed = parseIntParams({ page: 'abc' }, ['page'])
      expect(parsed.page).toBe('abc')
    })
  })

  describe('extractAllowedFields', () => {
    it('whitelists allowed fields only', () => {
      const filtered = extractAllowedFields(
        { name: 'X', role: 'admin', evil: 'yes' },
        ['name', 'role']
      )
      expect(filtered).toEqual({ name: 'X', role: 'admin' })
    })

    it('skips fields not present', () => {
      const filtered = extractAllowedFields({ name: 'X' }, ['name', 'role'])
      expect(filtered).toEqual({ name: 'X' })
    })
  })

  describe('successResponse', () => {
    it('returns success shape with data', () => {
      expect(successResponse({ id: 1 })).toEqual({ success: true, data: { id: 1 } })
    })

    it('includes message and meta', () => {
      const r = successResponse('x', { message: 'ok', meta: { total: 5 } })
      expect(r).toEqual({ success: true, message: 'ok', data: 'x', meta: { total: 5 } })
    })

    it('omits data if undefined', () => {
      expect(successResponse(undefined)).toEqual({ success: true })
    })
  })

  describe('errorResponse', () => {
    it('returns error shape', () => {
      expect(errorResponse('nope')).toEqual({ success: false, message: 'nope' })
    })

    it('includes code and details', () => {
      const r = errorResponse('bad', { code: 'E1', details: { field: 'x' } })
      expect(r).toEqual({
        success: false,
        message: 'bad',
        code: 'E1',
        details: { field: 'x' },
      })
    })
  })

  describe('validateIdParam', () => {
    it('accepts positive integers and converts', () => {
      const req = { params: { id: '15' } }
      const res = mockRes()
      const next = jest.fn()
      validateIdParam('integer')(req, res, next)
      expect(req.params.id).toBe(15)
      expect(next).toHaveBeenCalled()
    })

    it('rejects non-integer', () => {
      const res = mockRes()
      const next = jest.fn()
      validateIdParam('integer')({ params: { id: 'foo' } }, res, next)
      expect(res.status).toHaveBeenCalledWith(400)
      expect(next).not.toHaveBeenCalled()
    })

    it('rejects zero or negative', () => {
      const res = mockRes()
      const next = jest.fn()
      validateIdParam('integer')({ params: { id: '0' } }, res, next)
      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('rejects missing id', () => {
      const res = mockRes()
      const next = jest.fn()
      validateIdParam('integer')({ params: {} }, res, next)
      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('validates UUIDs', () => {
      const res = mockRes()
      const next = jest.fn()
      validateIdParam('uuid')(
        { params: { id: '550e8400-e29b-41d4-a716-446655440000' } },
        res,
        next
      )
      expect(next).toHaveBeenCalled()
    })

    it('rejects invalid UUID', () => {
      const res = mockRes()
      const next = jest.fn()
      validateIdParam('uuid')({ params: { id: 'not-a-uuid' } }, res, next)
      expect(res.status).toHaveBeenCalledWith(400)
    })
  })

  describe('addTimestamp', () => {
    it('adds ISO timestamp to given fields', () => {
      const req = { body: {} }
      const next = jest.fn()
      addTimestamp('created_at', 'updated_at')(req, mockRes(), next)
      expect(typeof req.body.created_at).toBe('string')
      expect(req.body.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      expect(req.body.updated_at).toBe(req.body.created_at)
      expect(next).toHaveBeenCalled()
    })
  })

  describe('conditionalMiddleware', () => {
    it('runs middleware when condition passes', () => {
      const mw = jest.fn((req, res, next) => next())
      const next = jest.fn()
      conditionalMiddleware(() => true, mw)({}, mockRes(), next)
      expect(mw).toHaveBeenCalled()
    })

    it('skips middleware when condition fails', () => {
      const mw = jest.fn()
      const next = jest.fn()
      conditionalMiddleware(() => false, mw)({}, mockRes(), next)
      expect(mw).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalled()
    })
  })
})
