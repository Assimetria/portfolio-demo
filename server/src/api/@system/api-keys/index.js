// @system — API key management
// GET    /api/api-keys             — list caller's API keys
// POST   /api/api-keys             — create a new API key (returns raw key once)
// DELETE /api/api-keys/:id         — revoke an API key
// GET    /api/api-keys/:id/usage   — usage stats for an API key
// PATCH  /api/api-keys/:id/scopes  — update scopes for an API key
const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const { authenticate } = require('../../../lib/@system/Helpers/auth')
const ApiKeyRepo = require('../../../db/repos/@system/ApiKeyRepo')
const { validate } = require('../../../lib/@system/Validation')
const { CreateApiKeyBody, DeleteApiKeyParams, UpdateScopesBody } = require('../../../lib/@system/Validation/schemas/@system/api-keys')
const { apiKeyLimiter } = require('../../../lib/@system/RateLimit')

const KEY_PREFIX = 'sk_'
const KEY_BYTES = 32 // 256 bits → 64 hex chars

// Available scopes that can be assigned to API keys
const AVAILABLE_SCOPES = [
  '*',                    // full access
  'read',                 // read-only access to all resources
  'write',                // write access to all resources
  'users:read',           // read user data
  'users:write',          // modify user data
  'teams:read',           // read team data
  'teams:write',          // modify teams
  'billing:read',         // read billing/subscription info
  'billing:write',        // manage subscriptions
  'storage:read',         // download files
  'storage:write',        // upload files
  'blog:read',            // read blog posts
  'blog:write',           // create/edit blog posts
  'admin',                // admin-only operations
]

function generateApiKey() {
  const raw = crypto.randomBytes(KEY_BYTES).toString('hex')
  return `${KEY_PREFIX}${raw}`
}

function hashKey(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

// GET /api/api-keys — list keys (hashes never returned)
router.get('/api-keys', authenticate, async (req, res, next) => {
  try {
    const keys = await ApiKeyRepo.findAllByUser(req.user.id)
    res.json({ apiKeys: keys })
  } catch (err) {
    next(err)
  }
})

// GET /api/api-keys/scopes — list available scopes
router.get('/api-keys/scopes', authenticate, (req, res) => {
  res.json({ scopes: AVAILABLE_SCOPES })
})

// POST /api/api-keys — create
router.post('/api-keys', authenticate, apiKeyLimiter, validate({ body: CreateApiKeyBody }), async (req, res, next) => {
  try {
    const { name, expiresAt, scopes, rateLimit } = req.body

    const raw = generateApiKey()
    const keyHash = hashKey(raw)
    const keyPrefix = raw.slice(0, KEY_PREFIX.length + 8) // "sk_" + first 8 hex chars

    const apiKey = await ApiKeyRepo.create({
      userId: req.user.id,
      name: name.trim(),
      keyHash,
      keyPrefix,
      expiresAt: expiresAt ?? null,
      scopes: scopes ?? ['*'],
      rateLimit: rateLimit ?? null,
    })

    // Return raw key only once — caller must save it
    res.status(201).json({ apiKey: { ...apiKey, key: raw } })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/api-keys/:id/scopes — update scopes
router.patch('/api-keys/:id/scopes', authenticate, validate({ params: DeleteApiKeyParams, body: UpdateScopesBody }), async (req, res, next) => {
  try {
    const updated = await ApiKeyRepo.updateScopes(req.params.id, req.user.id, req.body.scopes)
    if (!updated) return res.status(404).json({ message: 'API key not found' })
    res.json({ message: 'Scopes updated' })
  } catch (err) {
    next(err)
  }
})

// GET /api/api-keys/:id/usage — usage stats
router.get('/api-keys/:id/usage', authenticate, validate({ params: DeleteApiKeyParams }), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    const days = parseInt(req.query.days, 10) || 30

    const [stats, byEndpoint] = await Promise.all([
      ApiKeyRepo.getUsageStats(id, { days }),
      ApiKeyRepo.getUsageByEndpoint(id, { days }),
    ])

    res.json({ usage: { ...stats, byEndpoint } })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/api-keys/:id — revoke
router.delete('/api-keys/:id', authenticate, validate({ params: DeleteApiKeyParams }), async (req, res, next) => {
  try {
    const id = req.params.id

    const deleted = await ApiKeyRepo.deleteById(id, req.user.id)
    if (!deleted) return res.status(404).json({ message: 'API key not found' })

    res.json({ message: 'API key revoked' })
  } catch (err) {
    next(err)
  }
})

module.exports = router
module.exports.AVAILABLE_SCOPES = AVAILABLE_SCOPES
