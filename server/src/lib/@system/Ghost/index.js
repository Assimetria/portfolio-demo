// @system — Ghost CMS Content API client
// Mirrors Asymetric Ventures' Ghost blog integration.
// Set GHOST_URL and GHOST_CONTENT_API_KEY env vars to enable.
// Falls back gracefully — built-in blog system works without Ghost.
'use strict'

const logger = require('../Logger')

const GHOST_URL = process.env.GHOST_URL
const GHOST_CONTENT_API_KEY = process.env.GHOST_CONTENT_API_KEY
const GHOST_API_VERSION = 'v3'

function isConfigured() {
  return !!(GHOST_URL && GHOST_CONTENT_API_KEY)
}

async function fetchPosts({ limit = 6, page = 1, filter, include = 'tags,authors' } = {}) {
  if (!isConfigured()) return { posts: [], meta: {} }

  const url = new URL(`/ghost/api/${GHOST_API_VERSION}/content/posts/`, GHOST_URL)
  url.searchParams.set('key', GHOST_CONTENT_API_KEY)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('page', String(page))
  url.searchParams.set('include', include)
  if (filter) url.searchParams.set('filter', filter)

  try {
    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`Ghost API ${res.status}`)
    return res.json()
  } catch (err) {
    logger.error({ err }, '[Ghost] fetchPosts failed')
    return { posts: [], meta: {} }
  }
}

async function fetchPost(slug) {
  if (!isConfigured()) return null

  const url = new URL(`/ghost/api/${GHOST_API_VERSION}/content/posts/slug/${slug}/`, GHOST_URL)
  url.searchParams.set('key', GHOST_CONTENT_API_KEY)
  url.searchParams.set('include', 'tags,authors')

  try {
    const res = await fetch(url.toString())
    if (!res.ok) return null
    const data = await res.json()
    return data.posts?.[0] || null
  } catch (err) {
    logger.error({ err }, '[Ghost] fetchPost failed')
    return null
  }
}

function health() {
  return {
    provider: 'ghost',
    configured: isConfigured(),
    envVars: ['GHOST_URL', 'GHOST_CONTENT_API_KEY'],
  }
}

module.exports = { isConfigured, fetchPosts, fetchPost, health }
