const logger = require('../Logger')

const REDIS_URL = process.env.REDIS_URL

let client = null

if (REDIS_URL) {
  const Redis = require('ioredis')
  client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
  })

  client.on('connect', () => logger.info('Redis connected'))
  client.on('error', (err) => logger.error({ err }, 'Redis error'))
  client.on('close', () => logger.warn('Redis connection closed'))
} else {
  logger.info('REDIS_URL not set — running without Redis')
}

/**
 * Connect eagerly. Called from index.js at startup.
 * No-op when REDIS_URL is not configured.
 */
async function connect() {
  if (!client) return
  try {
    await client.connect()
  } catch (err) {
    logger.warn({ err }, 'Redis unavailable — running without Redis cache')
  }
}

/** True once the client has successfully connected at least once */
function isReady() {
  return client != null && client.status === 'ready'
}

module.exports = { client, connect, isReady }
