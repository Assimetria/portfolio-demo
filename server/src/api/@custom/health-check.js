// @custom — health check endpoint aggregating all downstream service dependencies
// GET /api/health-check/dependencies — returns status of all downstream services
const express = require('express')
const router = express.Router()
const { authenticate } = require('../../lib/@system/Helpers')

/**
 * Check a single dependency and return a standard result shape.
 * @param {string} name - Dependency name
 * @param {Function} checkFn - Async function that resolves on success or rejects on failure
 * @returns {Promise<{name: string, status: string, latency_ms: number, error?: string}>}
 */
async function checkDependency(name, checkFn) {
  const start = Date.now()
  try {
    await checkFn()
    return {
      name,
      status: 'healthy',
      latency_ms: Date.now() - start,
    }
  } catch (err) {
    return {
      name,
      status: 'unhealthy',
      latency_ms: Date.now() - start,
      error: err.message ? err.message.split('\n')[0].slice(0, 200) : 'Unknown error',
    }
  }
}

/**
 * Run all dependency health checks in parallel.
 * @returns {Promise<{status: string, timestamp: string, dependencies: Array, summary: object}>}
 */
async function aggregateHealthChecks() {
  const checks = []

  // 1. Database (PostgreSQL)
  checks.push(
    checkDependency('database', async () => {
      const db = require('../../lib/@system/PostgreSQL')
      await db.one('SELECT 1')
    })
  )

  // 2. Redis
  checks.push(
    checkDependency('redis', async () => {
      const Redis = require('../../lib/@system/Redis')
      if (!Redis.client) {
        throw new Error('Redis not configured (REDIS_URL not set)')
      }
      if (!Redis.isReady()) {
        throw new Error('Redis not ready')
      }
      // If client is available and ready, attempt a ping
      await Redis.client.ping()
    })
  )

  // 3. Auth / JWT
  checks.push(
    checkDependency('auth', async () => {
      const { signAccessTokenAsync, verifyAccessTokenAsync } = require('../../lib/@system/Helpers/jwt')
      const token = await signAccessTokenAsync({ sub: 'health-probe' }, { expiresIn: '5s' })
      await verifyAccessTokenAsync(token)
    })
  )

  // 4. Email
  checks.push(
    checkDependency('email', async () => {
      const Email = require('../../lib/@system/Email')
      // Check if email service is configured by checking the adapter
      if (!Email || typeof Email.sendEmail !== 'function') {
        throw new Error('Email service not configured')
      }
      // Email is considered healthy if the module is loadable and sendEmail is available
    })
  )

  // 5. Storage
  checks.push(
    checkDependency('storage', async () => {
      const StorageAdapter = require('../../lib/@system/StorageAdapter')
      if (!StorageAdapter || typeof StorageAdapter.getStatus !== 'function') {
        // If getStatus doesn't exist, just confirm the module loads
        if (!StorageAdapter) {
          throw new Error('Storage adapter not configured')
        }
      } else {
        await StorageAdapter.getStatus()
      }
    })
  )

  const dependencies = await Promise.all(checks)

  const healthy = dependencies.filter((d) => d.status === 'healthy').length
  const unhealthy = dependencies.filter((d) => d.status === 'unhealthy').length
  const total = dependencies.length

  const overallStatus = unhealthy === 0 ? 'healthy' : unhealthy === total ? 'unhealthy' : 'degraded'

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    dependencies,
    summary: {
      total,
      healthy,
      unhealthy,
    },
  }
}

// GET /api/health-check/dependencies — authenticated aggregated health check
router.get('/health-check/dependencies', authenticate, async (req, res, next) => {
  try {
    const result = await aggregateHealthChecks()
    const statusCode = result.status === 'healthy' ? 200 : 200 // Always 200 for liveness
    res.status(statusCode).json(result)
  } catch (err) {
    next(err)
  }
})

module.exports = router
