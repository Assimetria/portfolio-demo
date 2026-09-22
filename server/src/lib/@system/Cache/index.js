/**
 * Unified cache layer.
 * Uses Redis when available, falls back to in-process NodeCache.
 */
const redis = require('../Redis')
const nodeCache = require('../NodeCache')
const logger = require('../Logger')

/**
 * Get a cached value.
 * @param {string} key
 * @returns {Promise<any|undefined>}
 */
async function get(key) {
  if (redis.isReady()) {
    try {
      const raw = await redis.client.get(key)
      return raw == null ? undefined : JSON.parse(raw)
    } catch (err) {
      logger.warn({ err, key }, 'Redis get failed — falling back to NodeCache')
    }
  }
  return nodeCache.get(key)
}

/**
 * Set a cached value.
 * @param {string} key
 * @param {any} value
 * @param {number} [ttlSeconds=300]
 */
async function set(key, value, ttlSeconds = 300) {
  if (redis.isReady()) {
    try {
      await redis.client.set(key, JSON.stringify(value), 'EX', ttlSeconds)
      return
    } catch (err) {
      logger.warn({ err, key }, 'Redis set failed — falling back to NodeCache')
    }
  }
  nodeCache.set(key, value, ttlSeconds)
}

/**
 * Delete a cached value.
 * @param {string} key}
 */
async function del(key) {
  if (redis.isReady()) {
    try {
      await redis.client.del(key)
    } catch (err) {
      logger.warn({ err, key }, 'Redis del failed')
    }
  }
  nodeCache.del(key)
}

/**
 * Wrap an async factory with cache-aside logic.
 * @param {string} key
 * @param {() => Promise<any>} factory
 * @param {number} [ttlSeconds=300]
 */
async function getOrSet(key, factory, ttlSeconds = 300) {
  const cached = await get(key)
  if (cached !== undefined) return cached
  const value = await factory()
  await set(key, value, ttlSeconds)
  return value
}

module.exports = { get, set, del, getOrSet }
