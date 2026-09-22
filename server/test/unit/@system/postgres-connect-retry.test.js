'use strict'

// Unit tests for PostgreSQL.connectPool() bounded retry/backoff. pg-promise is
// mocked so no socket is opened; delays are shrunk via env.

const mockConnect = jest.fn()

jest.mock('pg-promise', () => {
  const db = { connect: (...a) => mockConnect(...a) }
  const pgp = jest.fn(() => db)
  pgp.end = jest.fn(async () => undefined)
  return jest.fn(() => pgp)
})

jest.mock('../../../src/lib/@system/Logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}))

let pg
let logger

beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://u:p@db.local:5432/app'
  process.env.DB_CONNECT_BASE_DELAY_MS = '1'
  process.env.DB_CONNECT_MAX_DELAY_MS = '4'
  process.env.DB_CONNECT_ATTEMPTS = '3'
  pg = require('../../../src/lib/@system/PostgreSQL')
  logger = require('../../../src/lib/@system/Logger')
})

beforeEach(() => {
  mockConnect.mockReset()
  jest.clearAllMocks()
})

const okConn = () => ({ client: { serverVersion: '16.1' }, done: jest.fn() })

describe('connectPool retry', () => {
  it('succeeds first time and marks the pool connected', async () => {
    mockConnect.mockResolvedValueOnce(okConn())
    await pg.connectPool()
    expect(mockConnect).toHaveBeenCalledTimes(1)
    expect(pg.isConnected()).toBe(true)
  })

  it('retries with backoff and succeeds on a later attempt', async () => {
    mockConnect
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(okConn())
    await pg.connectPool()
    expect(mockConnect).toHaveBeenCalledTimes(3)
    expect(pg.isConnected()).toBe(true)
    const retries = logger.warn.mock.calls.filter(([, msg]) => /retrying/.test(msg))
    expect(retries).toHaveLength(2)
    expect(retries[0][0]).toMatchObject({ attempt: 1, attempts: 3, retryInMs: 1 })
    expect(retries[1][0]).toMatchObject({ attempt: 2, attempts: 3, retryInMs: 2 })
  })

  it('gives up after the configured attempts and throws the last error', async () => {
    mockConnect.mockRejectedValue(new Error('still down'))
    await expect(pg.connectPool()).rejects.toThrow('still down')
    expect(mockConnect).toHaveBeenCalledTimes(3)
    expect(pg.isConnected()).toBe(false)
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ attempts: 3 }), expect.stringMatching(/after all attempts/))
  })

  it('caps the delay at DB_CONNECT_MAX_DELAY_MS', async () => {
    mockConnect
      .mockRejectedValueOnce(new Error('x'))
      .mockRejectedValueOnce(new Error('x'))
      .mockRejectedValueOnce(new Error('x'))
      .mockRejectedValueOnce(new Error('x'))
      .mockResolvedValueOnce(okConn())
    await pg.connectPool({ attempts: 5 })
    const delays = logger.warn.mock.calls.filter(([, msg]) => /retrying/.test(msg)).map(([o]) => o.retryInMs)
    expect(delays).toEqual([1, 2, 4, 4])
  })

  it('disconnectPool clears the connected flag', async () => {
    mockConnect.mockResolvedValueOnce(okConn())
    await pg.connectPool()
    await pg.disconnectPool()
    expect(pg.isConnected()).toBe(false)
    expect(pg.pgp.end).toHaveBeenCalled()
  })
})
