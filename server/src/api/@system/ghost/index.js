// @system — Ghost CMS webhook endpoint
// Mirrors Asymetric Ventures' POST /api/webhook/blog/publish handler.
// Ghost fires this webhook when a post is published/updated.
'use strict'

const express = require('express')
const router = express.Router()
const { createHash } = require('crypto')
const logger = require('../../../lib/@system/Logger')

const BLOG_SECRET_KEY = process.env.BLOG_SECRET_KEY

// POST /api/webhook/blog/publish — Ghost publish webhook
router.post('/webhook/blog/publish', express.json(), async (req, res) => {
  // Verify webhook secret if configured
  if (BLOG_SECRET_KEY) {
    const signature = req.headers['x-ghost-signature']
    if (signature) {
      const [hashPart] = signature.split(', ')
      const providedHash = hashPart?.replace('sha256=', '')
      const expectedHash = createHash('sha256')
        .update(JSON.stringify(req.body) + BLOG_SECRET_KEY)
        .digest('hex')
      if (providedHash !== expectedHash) {
        return res.status(401).json({ message: 'Invalid signature' })
      }
    }
  }

  const post = req.body?.post?.current
  if (post) {
    logger.info({ slug: post.slug, title: post.title }, '[Ghost] post published webhook received')
    // Products can hook into this via @custom to sync Ghost posts to built-in blog, invalidate caches, etc.
  }

  res.json({ ok: true })
})

module.exports = router
