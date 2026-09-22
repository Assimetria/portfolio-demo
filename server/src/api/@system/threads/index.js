// @system — User chat threads & messages API
// CRUD endpoints for a signed-in user's AI-chat threads (threads table) plus the
// messages nested inside each thread (messages table). Every thread/message read
// or mutation is scoped to the authenticated user; cross-user access 404s to avoid
// leaking the existence of another user's conversations.
'use strict'

const express = require('express')
const router = express.Router()
const { authenticate } = require('../../../lib/@system/Helpers/auth')
const ThreadRepo = require('../../../db/repos/@system/ThreadRepo')
const MessageRepo = require('../../../db/repos/@system/MessageRepo')

const VALID_SENDERS = new Set(['user', 'assistant', 'system'])

function toInt(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback
}

/**
 * Resolve a raw thread id param into an integer owned by req.user.
 * Sends a 400/404 response and returns null when the id is invalid or the
 * thread doesn't belong to the caller.
 */
async function loadOwnedThread(idParam, userId, res) {
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: 'Invalid thread id' })
    return null
  }
  const thread = await ThreadRepo.findById(id)
  if (!thread || thread.user_id !== userId) {
    res.status(404).json({ message: 'Thread not found' })
    return null
  }
  return thread
}

// GET /api/threads — list the caller's threads, newest activity first
router.get('/threads', authenticate, async (req, res, next) => {
  try {
    const limit = Math.min(toInt(req.query.limit, 20), 100)
    const offset = toInt(req.query.offset, 0)
    const threads = await ThreadRepo.findByUserId(req.user.id, { limit, offset })
    res.json({ threads })
  } catch (err) {
    next(err)
  }
})

// POST /api/threads — create a new thread for the caller
router.post('/threads', authenticate, async (req, res, next) => {
  try {
    const title = typeof req.body.title === 'string' ? req.body.title.trim().slice(0, 200) : 'New Chat'
    const externalId = typeof req.body.external_id === 'string' ? req.body.external_id.trim().slice(0, 255) : null
    const thread = await ThreadRepo.create({ user_id: req.user.id, title: title || 'New Chat', external_id: externalId })
    res.status(201).json({ thread })
  } catch (err) {
    next(err)
  }
})

// GET /api/threads/:id — fetch a single owned thread
router.get('/threads/:id', authenticate, async (req, res, next) => {
  try {
    const thread = await loadOwnedThread(req.params.id, req.user.id, res)
    if (!thread) return
    res.json({ thread })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/threads/:id — rename the caller's thread
router.patch('/threads/:id', authenticate, async (req, res, next) => {
  try {
    const existing = await loadOwnedThread(req.params.id, req.user.id, res)
    if (!existing) return
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : null
    if (!title) {
      return res.status(400).json({ message: 'title is required' })
    }
    const thread = await ThreadRepo.updateTitle(Number(req.params.id), req.user.id, title.slice(0, 200))
    res.json({ thread })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/threads/:id — delete the caller's thread (cascades messages)
router.delete('/threads/:id', authenticate, async (req, res, next) => {
  try {
    const existing = await loadOwnedThread(req.params.id, req.user.id, res)
    if (!existing) return
    const result = await ThreadRepo.delete(Number(req.params.id), req.user.id)
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Thread not found' })
    }
    res.json({ message: 'Thread deleted' })
  } catch (err) {
    next(err)
  }
})

// GET /api/threads/:id/messages — list messages inside an owned thread
router.get('/threads/:id/messages', authenticate, async (req, res, next) => {
  try {
    const existing = await loadOwnedThread(req.params.id, req.user.id, res)
    if (!existing) return
    const limit = Math.min(toInt(req.query.limit, 50), 200)
    const offset = toInt(req.query.offset, 0)
    const messages = await MessageRepo.findByThreadId(Number(req.params.id), { limit, offset })
    res.json({ messages })
  } catch (err) {
    next(err)
  }
})

// POST /api/threads/:id/messages — append a message and bump last_message_at
router.post('/threads/:id/messages', authenticate, async (req, res, next) => {
  try {
    const existing = await loadOwnedThread(req.params.id, req.user.id, res)
    if (!existing) return

    const content = typeof req.body.content === 'string' ? req.body.content.trim() : ''
    if (!content) {
      return res.status(400).json({ message: 'content is required' })
    }

    const sender = typeof req.body.sender === 'string' ? req.body.sender : 'user'
    if (!VALID_SENDERS.has(sender)) {
      return res.status(400).json({ message: `sender must be one of: ${[...VALID_SENDERS].join(', ')}` })
    }

    const metadata =
      req.body.metadata && typeof req.body.metadata === 'object' && !Array.isArray(req.body.metadata)
        ? req.body.metadata
        : {}

    const message = await MessageRepo.create({ thread_id: Number(req.params.id), sender, content, metadata })
    await ThreadRepo.updateLastMessageTime(Number(req.params.id))

    res.status(201).json({ message })
  } catch (err) {
    next(err)
  }
})

module.exports = router
