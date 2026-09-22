// @system — AI/LLM API routes
//
// All routes require authentication.
//
// OpenAI:
//   POST /api/ai/openai/chat            — Chat completion
//   POST /api/ai/openai/chat/stream     — Streaming chat (SSE)
//   POST /api/ai/openai/image           — Image generation
//   POST /api/ai/openai/embed           — Text embeddings
//
// Anthropic:
//   POST /api/ai/anthropic/message         — Message completion
//   POST /api/ai/anthropic/message/stream  — Streaming message (SSE)
//   POST /api/ai/anthropic/tokens          — Token count (pre-flight)
//
// Shared:
//   GET  /api/ai/models                — Available models per provider
//
// Request bodies are validated with zod (Validation/schemas/@system/ai.js).

const express = require('express')
const router = express.Router()

const { authenticate } = require('../../../lib/@system/Helpers/auth')
const { openai, anthropic } = require('../../../lib/@system/AI')
const { ValidationError } = require('../../../lib/@system/Errors')
const logger = require('../../../lib/@system/Logger')
const { aiChatLimiter, aiImageLimiter } = require('../../../lib/@system/RateLimit')
const { validate } = require('../../../lib/@system/Validation')
const { AiChatBody, AiImageBody, AiEmbedBody, AiTokensBody } = require('../../../lib/@system/Validation/schemas/@system/ai')

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Start an SSE response */
function startSSE(res) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
}

/** Write an SSE event */
function writeSSE(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

// ─── OpenAI routes ───────────────────────────────────────────────────────────

/**
 * POST /api/ai/openai/chat
 * Body: { prompt, system?, model?, maxTokens?, temperature?, messages? }
 */
router.post('/ai/openai/chat', authenticate, aiChatLimiter, validate({ body: AiChatBody }), async (req, res, next) => {
  try {
    const { prompt, system, model, maxTokens, temperature, messages } = req.body

    if (!prompt && !messages?.length) {
      throw new ValidationError('prompt or messages is required')
    }

    const result = await openai.chat({ prompt, system, model, maxTokens, temperature, messages })
    res.json({ ok: true, ...result })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/ai/openai/chat/stream
 * Body: { prompt, system?, model?, maxTokens?, temperature?, messages? }
 * Returns SSE stream: data: { type: 'delta'|'done', text?, ... }
 */
router.post('/ai/openai/chat/stream', authenticate, aiChatLimiter, validate({ body: AiChatBody }), async (req, res) => {
  const { prompt, system, model, maxTokens, temperature, messages } = req.body

  if (!prompt && !messages?.length) {
    return res.status(400).json({ message: 'prompt or messages is required' })
  }

  startSSE(res)

  try {
    const result = await openai.streamChat({
      prompt,
      system,
      model,
      maxTokens,
      temperature,
      messages,
      onDelta: (delta) => writeSSE(res, { type: 'delta', text: delta }),
    })

    writeSSE(res, { type: 'done', model: result.model, usage: result.usage })
  } catch (err) {
    logger.error({ err }, 'openai stream error')
    writeSSE(res, { type: 'error', message: err.message })
  }

  res.end()
})

/**
 * POST /api/ai/openai/image
 * Body: { prompt, model?, size?, quality?, style?, n? }
 */
router.post('/ai/openai/image', authenticate, aiImageLimiter, validate({ body: AiImageBody }), async (req, res, next) => {
  try {
    const { prompt, model, size, quality, style, n } = req.body
    if (!prompt) throw new ValidationError('prompt is required')

    const result = await openai.generateImage({ prompt, model, size, quality, style, n })
    res.json({ ok: true, ...result })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/ai/openai/embed
 * Body: { input, model? }
 * input can be a string or array of strings.
 */
router.post('/ai/openai/embed', authenticate, aiChatLimiter, validate({ body: AiEmbedBody }), async (req, res, next) => {
  try {
    const { input, model } = req.body
    if (!input) throw new ValidationError('input is required')

    const result = await openai.embed({ input, model })
    res.json({ ok: true, ...result })
  } catch (err) {
    next(err)
  }
})

// ─── Anthropic routes ─────────────────────────────────────────────────────────

/**
 * POST /api/ai/anthropic/message
 * Body: { prompt, system?, model?, maxTokens?, temperature?, messages? }
 */
router.post('/ai/anthropic/message', authenticate, aiChatLimiter, validate({ body: AiChatBody }), async (req, res, next) => {
  try {
    const { prompt, system, model, maxTokens, temperature, messages } = req.body

    if (!prompt && !messages?.length) {
      throw new ValidationError('prompt or messages is required')
    }

    const result = await anthropic.message({ prompt, system, model, maxTokens, temperature, messages })
    res.json({ ok: true, ...result })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/ai/anthropic/message/stream
 * Body: { prompt, system?, model?, maxTokens?, temperature?, messages? }
 * Returns SSE stream: data: { type: 'delta'|'done', text?, ... }
 */
router.post('/ai/anthropic/message/stream', authenticate, aiChatLimiter, validate({ body: AiChatBody }), async (req, res) => {
  const { prompt, system, model, maxTokens, temperature, messages } = req.body

  if (!prompt && !messages?.length) {
    return res.status(400).json({ message: 'prompt or messages is required' })
  }

  startSSE(res)

  try {
    const result = await anthropic.streamMessage({
      prompt,
      system,
      model,
      maxTokens,
      temperature,
      messages,
      onDelta: (delta) => writeSSE(res, { type: 'delta', text: delta }),
    })

    writeSSE(res, { type: 'done', model: result.model, usage: result.usage, stopReason: result.stopReason })
  } catch (err) {
    logger.error({ err }, 'anthropic stream error')
    writeSSE(res, { type: 'error', message: err.message })
  }

  res.end()
})

/**
 * POST /api/ai/anthropic/tokens
 * Body: { prompt, system?, model?, messages? }
 * Pre-flight token count — does not consume output tokens.
 */
router.post('/ai/anthropic/tokens', authenticate, aiChatLimiter, validate({ body: AiTokensBody }), async (req, res, next) => {
  try {
    const { prompt, system, model, messages } = req.body
    if (!prompt && !messages?.length) throw new ValidationError('prompt or messages is required')

    const result = await anthropic.countTokens({ prompt, system, model, messages })
    res.json({ ok: true, ...result })
  } catch (err) {
    next(err)
  }
})

// ─── Shared ───────────────────────────────────────────────────────────────────

/**
 * GET /api/ai/models
 * Returns available models per provider and configuration status.
 */
router.get('/ai/models', authenticate, (_req, res) => {
  res.json({
    ok: true,
    providers: {
      openai: {
        configured: openai.isConfigured(),
        models: openai.models,
      },
      anthropic: {
        configured: anthropic.isConfigured(),
        models: anthropic.models,
      },
    },
  })
})

module.exports = router
