// @system — Anthropic adapter
// Wraps the official @anthropic-ai/sdk with consistent error handling and logging.
//
// Usage:
//   const anthropic = require('../lib/@system/AI/Anthropic')
//   const reply = await anthropic.message({ prompt: 'Hello!' })
//   await anthropic.streamMessage({ prompt: 'Tell me a story', onDelta: (text) => process.stdout.write(text) })

const logger = require('../../Logger')
const { AppError } = require('../../Errors')

// Lazy-load SDK so the server boots even without the package installed
function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new AppError('ANTHROPIC_API_KEY is not configured', 503)
  try {
    const Anthropic = require('@anthropic-ai/sdk')
    return new Anthropic({ apiKey })
  } catch {
    throw new AppError('@anthropic-ai/sdk package is not installed. Run: npm install @anthropic-ai/sdk', 503)
  }
}

function handleError(err, context) {
  logger.error({ err, context }, 'Anthropic error')
  if (err instanceof AppError) throw err

  // Anthropic SDK error shapes
  const status = err.status ?? err.statusCode
  if (status === 401) throw new AppError('Anthropic API key is invalid or expired', 401)
  if (status === 429) throw new AppError('Anthropic rate limit exceeded — try again later', 429)
  if (status === 400) throw new AppError(`Anthropic bad request: ${err.message}`, 400)
  if (status === 529) throw new AppError('Anthropic API is overloaded — try again later', 503)
  if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
    throw new AppError('Cannot connect to Anthropic API', 503)
  }
  throw new AppError(`Anthropic error: ${err.message}`, 500)
}

const anthropicAdapter = {
  /**
   * Send a message and get a complete response (non-streaming).
   * @param {object}   opts
   * @param {string}   opts.prompt          - User message
   * @param {string}   [opts.system]        - System prompt
   * @param {string}   [opts.model]         - Model ID (default: claude-haiku-4-5-20251001)
   * @param {number}   [opts.maxTokens]     - Max output tokens (default: 1024)
   * @param {number}   [opts.temperature]   - Sampling temperature 0–1
   * @param {Array}    [opts.messages]      - Full messages array (overrides prompt)
   * @returns {Promise<{ content: string, model: string, usage: object, stopReason: string }>}
   */
  async message({
    prompt,
    system,
    model = 'claude-haiku-4-5-20251001',
    maxTokens = 1024,
    temperature,
    messages,
  }) {
    try {
      const client = getClient()

      const msgs = messages ?? [{ role: 'user', content: prompt }]

      const params = { model, max_tokens: maxTokens, messages: msgs }
      if (system) params.system = system
      if (temperature !== undefined) params.temperature = temperature

      logger.debug({ model, promptLength: prompt?.length }, 'anthropic.message')
      const res = await client.messages.create(params)

      const textBlock = res.content.find((b) => b.type === 'text')
      return {
        content: textBlock?.text ?? '',
        model: res.model,
        usage: res.usage,
        stopReason: res.stop_reason,
      }
    } catch (err) {
      handleError(err, 'message')
    }
  },

  /**
   * Streaming message — yields text deltas via callback.
   * @param {object}   opts
   * @param {string}   opts.prompt
   * @param {string}   [opts.system]
   * @param {string}   [opts.model]
   * @param {number}   [opts.maxTokens]
   * @param {number}   [opts.temperature]
   * @param {Array}    [opts.messages]
   * @param {Function} opts.onDelta        - Called with each text chunk: (delta: string) => void
   * @param {Function} [opts.onComplete]   - Called once when stream ends: ({ content, usage }) => void
   * @returns {Promise<{ content: string, model: string, usage: object, stopReason: string }>}
   */
  async streamMessage({
    prompt,
    system,
    model = 'claude-haiku-4-5-20251001',
    maxTokens = 1024,
    temperature,
    messages,
    onDelta,
    onComplete,
  }) {
    try {
      const client = getClient()

      const msgs = messages ?? [{ role: 'user', content: prompt }]

      const params = { model, max_tokens: maxTokens, messages: msgs }
      if (system) params.system = system
      if (temperature !== undefined) params.temperature = temperature

      logger.debug({ model }, 'anthropic.streamMessage')

      let content = ''
      let finalModel = model
      let usage = null
      let stopReason = null

      const stream = await client.messages.stream(params)

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          const delta = event.delta.text ?? ''
          if (delta) {
            content += delta
            if (typeof onDelta === 'function') onDelta(delta)
          }
        }
        if (event.type === 'message_delta') {
          if (event.delta?.stop_reason) stopReason = event.delta.stop_reason
          if (event.usage) usage = event.usage
        }
        if (event.type === 'message_start') {
          finalModel = event.message?.model ?? model
          if (event.message?.usage) usage = event.message.usage
        }
      }

      const result = { content, model: finalModel, usage, stopReason }
      if (typeof onComplete === 'function') onComplete(result)
      return result
    } catch (err) {
      handleError(err, 'streamMessage')
    }
  },

  /**
   * Count tokens for a given set of messages without sending them.
   * Useful for pre-flight checks before hitting context limits.
   * @param {object}  opts
   * @param {string}  opts.prompt
   * @param {string}  [opts.system]
   * @param {string}  [opts.model]
   * @param {Array}   [opts.messages]
   * @returns {Promise<{ inputTokens: number }>}
   */
  async countTokens({ prompt, system, model = 'claude-haiku-4-5-20251001', messages }) {
    try {
      const client = getClient()
      const msgs = messages ?? [{ role: 'user', content: prompt }]
      const params = { model, messages: msgs }
      if (system) params.system = system

      const res = await client.messages.countTokens(params)
      return { inputTokens: res.input_tokens }
    } catch (err) {
      handleError(err, 'countTokens')
    }
  },

  /**
   * Check whether the Anthropic adapter is configured (API key is set).
   * @returns {boolean}
   */
  isConfigured() {
    return !!process.env.ANTHROPIC_API_KEY
  },

  /** Available models grouped by tier */
  models: {
    opus: ['claude-opus-4-6'],
    sonnet: ['claude-sonnet-4-6'],
    haiku: ['claude-haiku-4-5-20251001'],
  },
}

module.exports = anthropicAdapter
