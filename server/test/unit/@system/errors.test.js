'use strict'

const { AppError, NotFoundError, ValidationError } = require('../../../src/lib/@system/Errors')

describe('AppError', () => {
  it('creates an error with a custom message and default 500 status', () => {
    const err = new AppError('Something broke')
    expect(err.message).toBe('Something broke')
    expect(err.status).toBe(500)
    expect(err.name).toBe('AppError')
    expect(err instanceof Error).toBe(true)
  })

  it('accepts a custom status code', () => {
    const err = new AppError('Bad gateway', 502)
    expect(err.status).toBe(502)
  })
})

describe('NotFoundError', () => {
  it('has status 404 and a user-friendly default message', () => {
    const err = new NotFoundError()
    expect(err.status).toBe(404)
    expect(err.message).toBe('The requested resource could not be found.')
    expect(err.name).toBe('NotFoundError')
  })

  it('accepts a custom message', () => {
    const err = new NotFoundError('This event could not be found.')
    expect(err.message).toBe('This event could not be found.')
    expect(err.status).toBe(404)
  })

  it('is an instance of AppError and Error', () => {
    const err = new NotFoundError()
    expect(err instanceof AppError).toBe(true)
    expect(err instanceof Error).toBe(true)
  })
})

describe('ValidationError', () => {
  it('has status 400 and a user-friendly default message', () => {
    const err = new ValidationError()
    expect(err.status).toBe(400)
    expect(err.message).toBe('The information provided is invalid. Please check your input and try again.')
    expect(err.name).toBe('ValidationError')
  })

  it('accepts a custom message', () => {
    const err = new ValidationError('Please enter a search term to get started.')
    expect(err.message).toBe('Please enter a search term to get started.')
    expect(err.status).toBe(400)
  })

  it('is an instance of AppError and Error', () => {
    const err = new ValidationError()
    expect(err instanceof AppError).toBe(true)
    expect(err instanceof Error).toBe(true)
  })
})
