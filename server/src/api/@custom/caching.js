// @custom — Caching strategies API endpoint
// Provides access to caching research strategies and recommendations.
//
// GET    /api/caching/strategies    — Returns all caching strategies
// POST   /api/caching/recommend     — Returns recommendation for given env

'use strict'

const express = require('express')
const router = express.Router()
const { authenticate } = require('../../lib/@system/Helpers/auth')
const { ValidationError } = require('../../lib/@system/Errors')
const { strategies, recommend } = require('../../lib/@custom/caching-research')

// ── GET /api/caching/strategies ──────────────────────────────────────────────
// Returns the full list of caching strategies with their ratings and metadata.

router.get('/caching/strategies', authenticate, async (req, res, next) => {
  try {
    res.json({
      ok: true,
      count: strategies.length,
      strategies,
    })
  } catch (err) {
    next(err)
  }
})

// ── POST /api/caching/recommend ──────────────────────────────────────────────
// Returns a caching recommendation based on the provided environment context.
// Body:
//   hasRedis        (boolean) — Whether Redis is available
//   isMultiProcess  (boolean) — Whether the app runs in multi-process mode

router.post('/caching/recommend', authenticate, async (req, res, next) => {
  try {
    const { hasRedis, isMultiProcess } = req.body

    if (hasRedis !== undefined && typeof hasRedis !== 'boolean') {
      throw new ValidationError('hasRedis must be a boolean if provided')
    }
    if (isMultiProcess !== undefined && typeof isMultiProcess !== 'boolean') {
      throw new ValidationError('isMultiProcess must be a boolean if provided')
    }

    const env = {}
    if (hasRedis !== undefined) env.hasRedis = hasRedis
    if (isMultiProcess !== undefined) env.isMultiProcess = isMultiProcess

    const result = recommend(Object.keys(env).length ? env : undefined)

    res.json({
      ok: true,
      env: {
        hasRedis: result.primary.requiresRedis,
        isMultiProcess:
          result.primary.id === 'redis-cache' ||
          result.primary.id === 'swr-client',
      },
      recommendation: result,
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router