const request = require('supertest')
const app = require('../../../src/app')

describe('GET /api/ping', () => {
  it('returns 200 with pong: true', async () => {
    const res = await request(app).get('/api/ping')
    expect(res.status).toBe(200)
    expect(res.body.pong).toBe(true)
  })

  it('returns JSON content-type', async () => {
    const res = await request(app).get('/api/ping')
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })

  it('is available without auth', async () => {
    // No Authorization header — should still return 200
    const res = await request(app).get('/api/ping')
    expect(res.status).toBe(200)
  })
})
