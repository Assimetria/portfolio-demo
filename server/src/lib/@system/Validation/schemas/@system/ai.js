// @system — zod request schemas for src/api/@system/ai/index.js
// Bodies for the OpenAI / Anthropic chat, stream, image, embed and token-count
// routes. Mirrors what the handlers destructure; message objects are passthrough
// because they are forwarded verbatim to the provider SDK.
const { z } = require('zod')

const MAX_PROMPT = 100000
const MAX_SYSTEM = 20000

const Message = z.object({
  role: z.string().min(1, 'role is required').max(50),
  content: z.any(),
}).passthrough()

const requirePromptOrMessages = {
  message: 'prompt or messages is required',
  path: ['prompt'],
}

// POST /ai/openai/chat, /ai/openai/chat/stream, /ai/anthropic/message, /ai/anthropic/message/stream
const AiChatBody = z.object({
  prompt: z.string().max(MAX_PROMPT).optional(),
  system: z.string().max(MAX_SYSTEM).optional().nullable(),
  model: z.string().max(100).optional(),
  maxTokens: z.coerce.number().int().positive().optional(),
  temperature: z.coerce.number().min(0).max(2).optional(),
  messages: z.array(Message).optional(),
}).refine((b) => Boolean(b.prompt) || (b.messages && b.messages.length > 0), requirePromptOrMessages)

// POST /ai/openai/image
const AiImageBody = z.object({
  prompt: z.string().min(1, 'prompt is required').max(4000),
  model: z.string().max(100).optional(),
  size: z.string().max(20).optional(),
  quality: z.string().max(20).optional(),
  style: z.string().max(20).optional(),
  n: z.coerce.number().int().min(1).max(10).optional(),
})

// POST /ai/openai/embed — input is a string or a non-empty array of strings
const AiEmbedBody = z.object({
  input: z.union([
    z.string().min(1, 'input is required').max(MAX_PROMPT),
    z.array(z.string().max(MAX_PROMPT)).min(1, 'input is required'),
  ]),
  model: z.string().max(100).optional(),
})

// POST /ai/anthropic/tokens
const AiTokensBody = z.object({
  prompt: z.string().max(MAX_PROMPT).optional(),
  system: z.string().max(MAX_SYSTEM).optional().nullable(),
  model: z.string().max(100).optional(),
  messages: z.array(Message).optional(),
}).refine((b) => Boolean(b.prompt) || (b.messages && b.messages.length > 0), requirePromptOrMessages)

module.exports = { AiChatBody, AiImageBody, AiEmbedBody, AiTokensBody }
