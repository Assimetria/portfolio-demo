// @system — OpenAI adapter
// Wraps the official openai SDK with consistent error handling and logging.
//
// Usage:
//   const openai = require('../lib/@system/AI/OpenAI')
//   const reply = await openai.chat({ prompt: 'Hello!' })
//   const { url } = await openai.generateImage({ prompt: 'A sunset' })
//   const embedding = await openai.embed({ input: 'some text' })

const logger = require('../../Logger')
const { AppError } = require('../../Errors')

// Lazy-load SDK so the server boots even without the package installed
function getClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new AppError('OPENAI_API_KEY is not configured', 503)
  try {
    const { default: OpenAI } = require('openai')
    return new OpenAI({ apiKey })
  } catch {
    throw new AppError('openai package is not installed. Run: npm install openai', 503)
  }
}

function handleError(err, context) {
  logger.error({ err, context }, 'OpenAI error')
  if (err instanceof AppError) throw err
  if (err.status === 401) throw new AppError('OpenAI API key is invalid or expired', 401)
  if (err.status === 429) throw new AppError('OpenAI rate limit exceeded — try again later', 429)
  if (err.status === 400) throw new AppError(`OpenAI bad request: ${err.message}`, 400)
  if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
    throw new AppError('Cannot connect to OpenAI API', 503)
  }
  throw new AppError(`OpenAI error: ${err.message}`, 500)
}

const openaiAdapter = {
  /**
   * Chat completion (non-streaming).
   * @param {object} opts
   * @param {string}  opts.prompt         - User message
   * @param {string}  [opts.system]       - Optional system prompt
   * @param {string}  [opts.model]        - Model ID (default: gpt-4o-mini)
   * @param {number}  [opts.maxTokens]    - Max output tokens
   * @param {number}  [opts.temperature]  - Sampling temperature 0–2
   * @param {Array}   [opts.messages]     - Full messages array (overrides prompt/system)
   * @returns {Promise<{ content: string, model: string, usage: object }>}
   */
  async chat({
    prompt,
    system,
    model = 'gpt-4o-mini',
    maxTokens,
    temperature = 1.0,
    messages,
  }) {
    try {
      const client = getClient()

      const msgs = messages ?? [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt },
      ]

      const params = { model, messages: msgs, temperature }
      if (maxTokens) params.max_tokens = maxTokens

      logger.debug({ model, promptLength: prompt?.length }, 'openai.chat')
      const res = await client.chat.completions.create(params)

      return {
        content: res.choices[0].message.content,
        model: res.model,
        usage: res.usage,
        finishReason: res.choices[0].finish_reason,
      }
    } catch (err) {
      handleError(err, 'chat')
    }
  },

  /**
   * Streaming chat completion — yields text deltas via callback.
   * @param {object}   opts
   * @param {string}   opts.prompt
   * @param {string}   [opts.system]
   * @param {string}   [opts.model]
   * @param {number}   [opts.maxTokens]
   * @param {number}   [opts.temperature]
   * @param {Function} opts.onDelta       - Called with each text chunk: (delta: string) => void
   * @returns {Promise<{ content: string, model: string, usage: object }>}
   */
  async streamChat({
    prompt,
    system,
    model = 'gpt-4o-mini',
    maxTokens,
    temperature = 1.0,
    messages,
    onDelta,
  }) {
    try {
      const client = getClient()

      const msgs = messages ?? [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt },
      ]

      const params = { model, messages: msgs, temperature, stream: true }
      if (maxTokens) params.max_tokens = maxTokens

      logger.debug({ model }, 'openai.streamChat')
      const stream = await client.chat.completions.create(params)

      let content = ''
      let finalModel = model
      let usage = null

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? ''
        if (delta) {
          content += delta
          if (typeof onDelta === 'function') onDelta(delta)
        }
        if (chunk.model) finalModel = chunk.model
        if (chunk.usage) usage = chunk.usage
      }

      return { content, model: finalModel, usage }
    } catch (err) {
      handleError(err, 'streamChat')
    }
  },

  /**
   * Generate an image with DALL-E or gpt-image-1.
   * @param {object} opts
   * @param {string}  opts.prompt
   * @param {string}  [opts.model]    - 'dall-e-3' | 'dall-e-2' | 'gpt-image-1' (default: dall-e-3)
   * @param {string}  [opts.size]     - '1024x1024' | '1792x1024' | '1024x1792'
   * @param {string}  [opts.quality]  - 'standard' | 'hd'
   * @param {string}  [opts.style]    - 'vivid' | 'natural'
   * @param {number}  [opts.n]        - Number of images (default: 1)
   * @returns {Promise<{ url: string, revisedPrompt: string, allImages: Array }>}
   */
  async generateImage({
    prompt,
    model = 'dall-e-3',
    size = '1024x1024',
    quality = 'standard',
    style = 'vivid',
    n = 1,
  }) {
    try {
      const client = getClient()

      const params = { model, prompt, n, size }

      if (model === 'dall-e-2' || model === 'dall-e-3') {
        params.response_format = 'url'
      }
      if (model === 'dall-e-3' || model === 'gpt-image-1') {
        params.quality = quality
        params.style = style
      }

      logger.debug({ model, promptLength: prompt.length, size }, 'openai.generateImage')
      const res = await client.images.generate(params)

      if (!res.data?.length) throw new AppError('OpenAI returned no images', 500)

      return {
        url: res.data[0].url,
        revisedPrompt: res.data[0].revised_prompt ?? prompt,
        allImages: res.data.map((img) => ({ url: img.url, revisedPrompt: img.revised_prompt ?? prompt })),
      }
    } catch (err) {
      handleError(err, 'generateImage')
    }
  },

  /**
   * Create text embeddings.
   * @param {object}          opts
   * @param {string|string[]} opts.input  - Text(s) to embed
   * @param {string}          [opts.model] - Embedding model (default: text-embedding-3-small)
   * @returns {Promise<{ embeddings: number[][], model: string, usage: object }>}
   */
  async embed({ input, model = 'text-embedding-3-small' }) {
    try {
      const client = getClient()

      logger.debug({ model }, 'openai.embed')
      const res = await client.embeddings.create({ model, input })

      return {
        embeddings: res.data.map((d) => d.embedding),
        model: res.model,
        usage: res.usage,
      }
    } catch (err) {
      handleError(err, 'embed')
    }
  },

  /**
   * Check whether the OpenAI adapter is configured (API key is set).
   * @returns {boolean}
   */
  isConfigured() {
    return !!process.env.OPENAI_API_KEY
  },

  /** Available models grouped by capability */
  models: {
    chat: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini', 'o3-mini'],
    image: ['dall-e-3', 'dall-e-2', 'gpt-image-1'],
    embedding: ['text-embedding-3-large', 'text-embedding-3-small', 'text-embedding-ada-002'],
  },
}

module.exports = openaiAdapter
