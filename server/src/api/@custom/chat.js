// @custom — Chat state management endpoint
// Provides a unified API for the chat page to manage threads, messages,
// and AI interactions through the existing @system ThreadRepo/MessageRepo.
//
//  GET    /api/chat/threads             — list user's threads
//  POST   /api/chat/threads             — create a new thread
//  GET    /api/chat/threads/:id         — get a single thread
//  PATCH  /api/chat/threads/:id         — update thread title
//  DELETE /api/chat/threads/:id         — delete a thread
//  GET    /api/chat/threads/:id/messages — get messages for a thread
//  POST   /api/chat/threads/:id/messages — add a message to a thread
//  POST   /api/chat/threads/:id/send     — send message + get AI response
//  POST   /api/chat/threads/:id/stream   — send message + stream AI response (SSE)

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../lib/@system/Helpers/auth');
const ThreadRepo = require('../../db/repos/@system/ThreadRepo');
const MessageRepo = require('../../db/repos/@system/MessageRepo');

const VALID_SENDERS = new Set(['user', 'assistant', 'system']);

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

async function loadOwnedThread(idParam, userId, res) {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: 'Invalid thread id' });
    return null;
  }
  const thread = await ThreadRepo.findById(id);
  if (!thread || thread.user_id !== userId) {
    res.status(404).json({ message: 'Thread not found' });
    return null;
  }
  return thread;
}

// GET /api/chat/threads — list the user's threads
router.get('/chat/threads', authenticate, async (req, res, next) => {
  try {
    const limit = Math.min(toInt(req.query.limit, 20), 100);
    const offset = toInt(req.query.offset, 0);
    const threads = await ThreadRepo.findByUserId(req.user.id, { limit, offset });
    res.json({ threads });
  } catch (err) {
    next(err);
  }
});

// POST /api/chat/threads — create a new thread
router.post('/chat/threads', authenticate, async (req, res, next) => {
  try {
    const title =
      typeof req.body.title === 'string'
        ? req.body.title.trim().slice(0, 200)
        : 'New Chat';
    const thread = await ThreadRepo.create({
      user_id: req.user.id,
      title: title || 'New Chat',
    });
    res.status(201).json({ thread });
  } catch (err) {
    next(err);
  }
});

// GET /api/chat/threads/:id — get a single thread
router.get('/chat/threads/:id', authenticate, async (req, res, next) => {
  try {
    const thread = await loadOwnedThread(req.params.id, req.user.id, res);
    if (!thread) return;
    res.json({ thread });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/chat/threads/:id — update thread title
router.patch('/chat/threads/:id', authenticate, async (req, res, next) => {
  try {
    const existing = await loadOwnedThread(req.params.id, req.user.id, res);
    if (!existing) return;
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : null;
    if (!title) {
      return res.status(400).json({ message: 'title is required' });
    }
    const thread = await ThreadRepo.updateTitle(
      Number(req.params.id),
      req.user.id,
      title.slice(0, 200),
    );
    res.json({ thread });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/chat/threads/:id — delete a thread
router.delete('/chat/threads/:id', authenticate, async (req, res, next) => {
  try {
    const existing = await loadOwnedThread(req.params.id, req.user.id, res);
    if (!existing) return;
    await ThreadRepo.delete(Number(req.params.id), req.user.id);
    res.json({ message: 'Thread deleted' });
  } catch (err) {
    next(err);
  }
});

// GET /api/chat/threads/:id/messages — get messages for a thread
router.get('/chat/threads/:id/messages', authenticate, async (req, res, next) => {
  try {
    const existing = await loadOwnedThread(req.params.id, req.user.id, res);
    if (!existing) return;
    const limit = Math.min(toInt(req.query.limit, 50), 200);
    const offset = toInt(req.query.offset, 0);
    const messages = await MessageRepo.findByThreadId(Number(req.params.id), {
      limit,
      offset,
    });
    res.json({ messages });
  } catch (err) {
    next(err);
  }
});

// POST /api/chat/threads/:id/messages — add a message to a thread
router.post('/chat/threads/:id/messages', authenticate, async (req, res, next) => {
  try {
    const existing = await loadOwnedThread(req.params.id, req.user.id, res);
    if (!existing) return;

    const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
    if (!content) {
      return res.status(400).json({ message: 'content is required' });
    }

    const sender = typeof req.body.sender === 'string' ? req.body.sender : 'user';
    if (!VALID_SENDERS.has(sender)) {
      return res.status(400).json({
        message: `sender must be one of: ${[...VALID_SENDERS].join(', ')}`,
      });
    }

    const metadata =
      req.body.metadata && typeof req.body.metadata === 'object' && !Array.isArray(req.body.metadata)
        ? req.body.metadata
        : {};

    const message = await MessageRepo.create({
      thread_id: Number(req.params.id),
      sender,
      content,
      metadata,
    });
    await ThreadRepo.updateLastMessageTime(Number(req.params.id));

    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
});

module.exports = router;