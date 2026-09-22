// @system — Replicate AI image generation integration
// Mirrors Asymetric Ventures' Replicate integration.
// Required env vars:
//   REPLICATE_API_TOKEN — Replicate API token
//   OPENAI_API_KEY      — OpenAI key (used by gpt-image-1 model on Replicate)
//
// Usage:
//   const Replicate = require('../Replicate')
//   const { link, base64 } = await Replicate.generateImage({ prompt: '...', aspect_ratio: '1:1' })

'use strict'

const logger = require('../Logger')

let replicateClient = null

function getClient() {
  if (replicateClient) return replicateClient
  try {
    const Replicate = require('replicate')
    replicateClient = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })
    return replicateClient
  } catch (err) {
    logger.warn({ err }, '[Replicate] replicate package not installed')
    return null
  }
}

async function urlToBase64(url) {
  try {
    const res = await fetch(url)
    const buffer = Buffer.from(await res.arrayBuffer())
    return buffer.toString('base64')
  } catch {
    return null
  }
}

function extractUrl(output) {
  if (Array.isArray(output) && output.length > 0) {
    const item = output[0]
    if (typeof item === 'string') return item
    if (typeof item.url === 'function') return String(item.url())
    if (typeof item.url === 'string') return item.url
    if (item.href) return item.href
  }
  if (typeof output === 'string') return output
  if (output?.href) return output.href
  return null
}

const ReplicateIntegration = {
  isConfigured() {
    return !!process.env.REPLICATE_API_TOKEN
  },

  async generateImage({ prompt, aspect_ratio = '1:1', input_images = null, maxRetries = 3 }) {
    const client = getClient()
    if (!client) throw new Error('Replicate not configured')

    let lastError = null
    let currentPrompt = prompt

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          logger.info({ attempt, maxRetries }, '[Replicate] retrying image generation')
          // Exponential backoff
          await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000))

          // Make prompt safer on subsequent retries
          if (lastError?.message?.includes('flagged as sensitive') && attempt === maxRetries) {
            currentPrompt = 'Abstract colorful shapes and geometric patterns in a modern minimalist style.'
          }
        }

        const input = {
          prompt: currentPrompt,
          aspect_ratio,
          openai_api_key: process.env.OPENAI_API_KEY,
        }
        if (input_images?.length) input.input_images = input_images

        const output = await client.run('openai/gpt-image-1', { input })
        const link = extractUrl(output)
        if (!link) throw new Error(`Unexpected output format: ${JSON.stringify(output)}`)

        const base64 = await urlToBase64(link)
        logger.info('[Replicate] image generated successfully')
        return { link, base64 }
      } catch (err) {
        lastError = err
        logger.error({ err, attempt, maxRetries }, '[Replicate] generation attempt failed')
        if (attempt === maxRetries) throw err
      }
    }

    throw lastError || new Error('Image generation failed after all retries')
  },

  health() {
    return {
      provider: 'replicate',
      configured: this.isConfigured(),
      envVars: ['REPLICATE_API_TOKEN'],
    }
  },
}

module.exports = ReplicateIntegration
