// Route-level unit tests for the user threads & messages API (POST/GET/PATCH/DELETE
// /threads and nested /threads/:id/messages).
//
// The server router is exercised in isolation: authentication middleware is
// replaced with a deterministic identity and the thread / message repositories
// are mocked, so ownership scoping, validation and routing can be asserted
// without any database.
'use strict'

const request = require('supertest')
const express = require('express')

const USER_ID = 7
const OTHER_ID = 99

const USER = { id: USER_ID, email: 'chatter@example.com', name: 'Chatter' }

const MOCK_THREAD = {
  id: 11,
  user_id: USER_ID,
  title: 'Set up my workflow',
  external_id: null,
  last_message_at: new Date('2026-09-01T00:00:00Z').toISOString(),
  created_at: new Date('2026-08-30T00:00:00Z').toISOString(),
}

const MOCK_FOREIGN_THREAD = { ...MOCK_THREAD, id: 22, user_id: OTHER_ID }

const MOCK_MESSAGE = {
  id: 3,
  thread_id: 11,
  sender: 'user',
  content: 'Hello world',
  metadata: { note: 'x' },
  created_at: new Date().toISOString(),
}

// Replace authentication with a fixed caller identity.
// NOTE: jest.mock() factories are hoisted above the `const` declarations in
// this file, so the factory must not close over USER/USER_ID (TDZ error).
// The literal below must stay in sync with USER above.
jest.mock('../../../src/lib/@system/Helpers/auth', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 7, email: 'chatter@example.com', name: 'Chatter' }
    next()
  },
  requireAdmin: (req, res, next) =>
    req.user && req.user.role === 'admin' ? next() : res.status(403).json({ message: 'Forbidden' }),
}))

jest.mock('../../../src/db/repos/@system/ThreadRepo', () => ({
  findById: jest.fn(),
  findByUserId: jest.fn(),
  create: jest.fn(),
  updateLastMessageTime: jest.fn(),
  updateTitle: jest.fn(),
  delete: jest.fn(),
}))

jest.mock('../../../src/db/repos/@system/MessageRepo', () => ({
  findByThreadId: jest.fn(),
  create: jest.fn(),
  countByThreadId: jest.fn(),
}))

const ThreadRepo = require('../../../src/db/repos/@system/ThreadRepo')
const MessageRepo = require('../../../src/db/repos/@system/MessageRepo')
const router = require('../../../src/api/@system/threads')

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use(router)
  app.use((err, _req, res, _next) => {
    res.status(500).json({ message: err.message })
  })
  return app
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('threads list + create', () => {
  it('GET /threads lists the caller threads newest first', async () => {
    ThreadRepo.findByUserId.mockResolvedValue([MOCK_THREAD])
    const res = await request(buildApp()).get('/threads').expect(200)
    expect(ThreadRepo.findByUserId).toHaveBeenCalledWith(USER_ID, { limit: 20, offset: 0 })
    expect(res.body.threads).toHaveLength(1)
  })

  it('GET /threads clamps the page size', async () => {
    ThreadRepo.findByUserId.mockResolvedValue([])
    await request(buildApp()).get('/threads?limit=500&offset=5').expect(200)
    expect(ThreadRepo.findByUserId).toHaveBeenCalledWith(USER_ID, { limit: 100, offset: 5 })
  })

  it('POST /threads creates a thread owned by the caller', async () => {
    ThreadRepo.create.mockResolvedValue(MOCK_THREAD)
    const res = await request(buildApp())
      .post('/threads')
      .send({ title: 'New convo', external_id: 'abc-1' })
      .expect(201)
    expect(ThreadRepo.create).toHaveBeenCalledWith({
      user_id: USER_ID,
      title: 'New convo',
      external_id: 'abc-1',
    })
    expect(res.body.thread.id).toBe(11)
  })

  it('POST /threads falls back to a default empty title', async () => {
    ThreadRepo.create.mockResolvedValue(MOCK_THREAD)
    await request(buildApp()).post('/threads').send({}).expect(201)
    expect(ThreadRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, title: 'New Chat', external_id: null }),
    )
  })
})

describe('thread retrieval + rename + delete', () => {
  it('GET /threads/:id fetches an owned thread', async () => {
    ThreadRepo.findById.mockResolvedValue(MOCK_THREAD)
    const res = await request(buildApp()).get('/threads/11').expect(200)
    expect(ThreadRepo.findById).toHaveBeenCalledWith(11)
    expect(res.body.thread.title).toBe('Set up my workflow')
  })

  it('GET /threads/:id returns 400 for a non-numeric id', async () => {
    const res = await request(buildApp()).get('/threads/not-a-number').expect(400)
    expect(res.body.message).toMatch(/invalid thread id/i)
  })

  it('returns 404 when the thread belongs to another user', async () => {
    ThreadRepo.findById.mockResolvedValue(MOCK_FOREIGN_THREAD)
    const res = await request(buildApp()).get('/threads/22').expect(404)
    expect(res.body.message).toMatch(/not found/i)
  })

  it('returns 404 when the thread does not exist at all', async () => {
    ThreadRepo.findById.mockResolvedValue(null)
    await request(buildApp()).get('/threads/999').expect(404)
  })

  it('PATCH /threads/:id renames the thread', async () => {
    ThreadRepo.findById.mockResolvedValue(MOCK_THREAD)
    ThreadRepo.updateTitle.mockResolvedValue({ ...MOCK_THREAD, title: 'Renamed' })
    const res = await request(buildApp()).patch('/threads/11').send({ title: 'Renamed' }).expect(200)
    expect(ThreadRepo.updateTitle).toHaveBeenCalledWith(11, USER_ID, 'Renamed')
    expect(res.body.thread.title).toBe('Renamed')
  })

  it('PATCH /threads/:id requires a non-empty title', async () => {
    ThreadRepo.findById.mockResolvedValue(MOCK_THREAD)
    const res = await request(buildApp()).patch('/threads/11').send({ title: '   ' }).expect(400)
    expect(res.body.message).toMatch(/title is required/i)
  })

  it('PATCH /threads/:id rejects a foreign thread', async () => {
    ThreadRepo.findById.mockResolvedValue(MOCK_FOREIGN_THREAD)
    await request(buildApp()).patch('/threads/22').send({ title: 'x' }).expect(404)
  })

  it('DELETE /threads/:id deletes an owned thread', async () => {
    ThreadRepo.findById.mockResolvedValue(MOCK_THREAD)
    ThreadRepo.delete.mockResolvedValue({ rowCount: 1 })
    const res = await request(buildApp()).delete('/threads/11').expect(200)
    expect(ThreadRepo.delete).toHaveBeenCalledWith(11, USER_ID)
    expect(res.body.message).toMatch(/deleted/i)
  })

  it('DELETE /threads/:id returns 404 for a foreign thread', async () => {
    ThreadRepo.findById.mockResolvedValue(MOCK_FOREIGN_THREAD)
    await request(buildApp()).delete('/threads/22').expect(404)
  })
})

describe('messages endpoints', () => {
  it('GET /threads/:id/messages lists messages inside an owned thread', async () => {
    ThreadRepo.findById.mockResolvedValue(MOCK_THREAD)
    MessageRepo.findByThreadId.mockResolvedValue([MOCK_MESSAGE])
    const res = await request(buildApp()).get('/threads/11/messages').expect(200)
    expect(MessageRepo.findByThreadId).toHaveBeenCalledWith(11, { limit: 50, offset: 0 })
    expect(res.body.messages).toHaveLength(1)
  })

  it('GET /threads/:id/messages rejects a foreign thread', async () => {
    ThreadRepo.findById.mockResolvedValue(MOCK_FOREIGN_THREAD)
    await request(buildApp()).get('/threads/22/messages').expect(404)
  })

  it('POST /threads/:id/messages appends a message and bumps last activity', async () => {
    ThreadRepo.findById.mockResolvedValue(MOCK_THREAD)
    MessageRepo.create.mockResolvedValue(MOCK_MESSAGE)
    ThreadRepo.updateLastMessageTime.mockResolvedValue(MOCK_THREAD)

    const res = await request(buildApp())
      .post('/threads/11/messages')
      .send({ sender: 'user', content: 'Hello world', metadata: { note: 'x' } })
      .expect(201)

    expect(MessageRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ thread_id: 11, sender: 'user', content: 'Hello world' }),
    )
    expect(ThreadRepo.updateLastMessageTime).toHaveBeenCalledWith(11)
    expect(res.body.message.id).toBe(3)
  })

  it('POST /threads/:id/messages defaults the sender to user', async () => {
    ThreadRepo.findById.mockResolvedValue(MOCK_THREAD)
    MessageRepo.create.mockResolvedValue(MOCK_MESSAGE)
    ThreadRepo.updateLastMessageTime.mockResolvedValue(MOCK_THREAD)
    await request(buildApp()).post('/threads/11/messages').send({ content: 'hi' }).expect(201)
    expect(MessageRepo.create).toHaveBeenCalledWith(expect.objectContaining({ sender: 'user' }))
  })

  it('rejects empty content', async () => {
    ThreadRepo.findById.mockResolvedValue(MOCK_THREAD)
    const res = await request(buildApp()).post('/threads/11/messages').send({ content: '  ' }).expect(400)
    expect(res.body.message).toMatch(/content is required/i)
  })

  it('rejects an unknown sender', async () => {
    ThreadRepo.findById.mockResolvedValue(MOCK_THREAD)
    const res = await request(buildApp())
      .post('/threads/11/messages')
      .send({ sender: 'tool', content: 'hi' })
      .expect(400)
    expect(res.body.message).toMatch(/sender must be one of/i)
  })

  it('rejects posting to a foreign thread', async () => {
    ThreadRepo.findById.mockResolvedValue(MOCK_FOREIGN_THREAD)
    await request(buildApp()).post('/threads/22/messages').send({ content: 'hi' }).expect(404)
  })
})
