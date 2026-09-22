const {
  success,
  created,
  noContent,
  error,
  notFound,
  unauthorized,
  forbidden,
  validationError,
  conflict,
  tooManyRequests,
  serverError,
} = require('../../../src/lib/@system/Helpers/response')

const mockRes = () => {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  res.set = jest.fn().mockReturnValue(res)
  res.end = jest.fn().mockReturnValue(res)
  return res
}

describe('response helpers', () => {
  describe('success', () => {
    it('sends 200 by default with data', () => {
      const res = mockRes()
      success(res, { id: 1 })
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 1 } })
    })

    it('includes message when provided', () => {
      const res = mockRes()
      success(res, { x: 1 }, 'done', 202)
      expect(res.status).toHaveBeenCalledWith(202)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'done',
        data: { x: 1 },
      })
    })

    it('omits data if undefined', () => {
      const res = mockRes()
      success(res, undefined)
      expect(res.json).toHaveBeenCalledWith({ success: true })
    })
  })

  describe('created', () => {
    it('sends 201 with default message', () => {
      const res = mockRes()
      created(res, { id: 5 })
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Resource created',
        data: { id: 5 },
      })
    })
  })

  describe('noContent', () => {
    it('sends 204 with no body', () => {
      const res = mockRes()
      noContent(res)
      expect(res.status).toHaveBeenCalledWith(204)
      expect(res.end).toHaveBeenCalled()
      expect(res.json).not.toHaveBeenCalled()
    })
  })

  describe('error', () => {
    it('sends 400 by default', () => {
      const res = mockRes()
      error(res, 'bad')
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'bad' })
    })

    it('includes errors when provided', () => {
      const res = mockRes()
      error(res, 'invalid', 422, { email: 'required' })
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'invalid',
        errors: { email: 'required' },
      })
    })
  })

  describe('notFound', () => {
    it('sends 404 with default message', () => {
      const res = mockRes()
      notFound(res)
      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Resource not found',
      })
    })
  })

  describe('unauthorized', () => {
    it('sends 401', () => {
      const res = mockRes()
      unauthorized(res)
      expect(res.status).toHaveBeenCalledWith(401)
    })
  })

  describe('forbidden', () => {
    it('sends 403', () => {
      const res = mockRes()
      forbidden(res)
      expect(res.status).toHaveBeenCalledWith(403)
    })
  })

  describe('validationError', () => {
    it('sends 422 with errors', () => {
      const res = mockRes()
      validationError(res, { name: 'required' })
      expect(res.status).toHaveBeenCalledWith(422)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        errors: { name: 'required' },
      })
    })
  })

  describe('conflict', () => {
    it('sends 409', () => {
      const res = mockRes()
      conflict(res)
      expect(res.status).toHaveBeenCalledWith(409)
    })
  })

  describe('tooManyRequests', () => {
    it('sends 429 and sets Retry-After', () => {
      const res = mockRes()
      tooManyRequests(res, 'slow down', 30)
      expect(res.set).toHaveBeenCalledWith('Retry-After', '30')
      expect(res.status).toHaveBeenCalledWith(429)
    })

    it('does not set Retry-After when omitted', () => {
      const res = mockRes()
      tooManyRequests(res)
      expect(res.set).not.toHaveBeenCalled()
    })
  })

  describe('serverError', () => {
    it('sends 500', () => {
      const res = mockRes()
      serverError(res)
      expect(res.status).toHaveBeenCalledWith(500)
    })
  })
})
