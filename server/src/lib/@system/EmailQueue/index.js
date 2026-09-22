/**
 * Email Queue System
 * 
 * Provides background processing for emails using BullMQ.
 * Supports retries, rate limiting, scheduled sends, and bulk operations.
 */

const logger = require('../Logger')
const Email = require('../Email')

let Queue = null
let Worker = null
let QueueScheduler = null
let queue = null
let worker = null
let scheduler = null
let initialized = false

/**
 * Initialize the email queue
 * 
 * @param {Object} options - Queue configuration
 * @param {string} options.redisUrl - Redis connection URL (or from env)
 * @param {boolean} options.startWorker - Whether to start worker (default: true)
 * @param {number} options.concurrency - Worker concurrency (default: 5)
 * @returns {Promise<void>}
 */
async function init(options = {}) {
  const redisUrl = options.redisUrl || process.env.REDIS_URL

  if (!redisUrl) {
    logger.warn('[EmailQueue] Redis URL not configured - email queue disabled, using direct send')
    return
  }

  try {
    // Lazy load BullMQ only if Redis is configured
    const BullMQ = require('bullmq')
    Queue = BullMQ.Queue
    Worker = BullMQ.Worker
    QueueScheduler = BullMQ.QueueScheduler

    // Parse Redis URL
    const connection = parseRedisUrl(redisUrl)

    // Create queue
    queue = new Queue('email', { connection })

    // Create scheduler (handles delayed jobs)
    scheduler = new QueueScheduler('email', { connection })

    // Start worker if requested
    if (options.startWorker !== false) {
      worker = new Worker('email', processEmailJob, {
        connection,
        concurrency: options.concurrency || 5,
      })

      worker.on('completed', (job) => {
        logger.info({ jobId: job.id, name: job.name }, '[EmailQueue] Job completed')
      })

      worker.on('failed', (job, err) => {
        logger.error({ jobId: job?.id, name: job?.name, err }, '[EmailQueue] Job failed')
      })

      logger.info('[EmailQueue] Worker started')
    }

    initialized = true
    logger.info({
      redisUrl: maskRedisUrl(redisUrl),
      workerStarted: options.startWorker !== false,
    }, '[EmailQueue] Queue initialized')
  } catch (err) {
    logger.error({ err }, '[EmailQueue] Failed to initialize - falling back to direct send')
    Queue = null
    Worker = null
    QueueScheduler = null
  }
}

/**
 * Process email job
 * 
 * @param {Object} job - BullMQ job object
 * @returns {Promise<Object>} Email send result
 */
async function processEmailJob(job) {
  const { type, data } = job.data

  logger.info({ jobId: job.id, type, recipient: data.to }, '[EmailQueue] Processing email job')

  switch (type) {
    case 'transactional':
      return await Email.send(data)

    case 'verification':
      return await Email.sendVerificationEmail(data)

    case 'passwordReset':
      return await Email.sendPasswordResetEmail(data)

    case 'magicLink':
      return await Email.sendMagicLinkEmail(data)

    case 'invitation':
      return await Email.sendInvitationEmail(data)

    case 'welcome':
      return await Email.sendWelcomeEmail(data)

    case 'notification':
      return await Email.sendNotificationEmail(data)

    case 'bulk':
      // Batch processing with rate limiting
      const results = []
      for (const recipient of data.recipients) {
        try {
          const result = await Email.send({
            to: recipient.email,
            subject: data.subject,
            html: data.html,
            text: data.text,
          })
          results.push({ email: recipient.email, success: true, result })

          // Rate limit: wait 100ms between sends
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (err) {
          logger.error({ err, email: recipient.email }, '[EmailQueue] Bulk email failed')
          results.push({ email: recipient.email, success: false, error: err.message })
        }
      }
      return { total: data.recipients.length, results }

    default:
      throw new Error(`Unknown email job type: ${type}`)
  }
}

/**
 * Queue a transactional email
 * 
 * @param {Object} emailData - Email data (to, subject, html, etc.)
 * @param {Object} options - Queue options
 * @param {number} options.delay - Delay in milliseconds
 * @param {number} options.priority - Priority (lower = higher priority)
 * @param {number} options.attempts - Max retry attempts (default: 3)
 * @returns {Promise<Object>} Job object
 */
async function queueEmail(emailData, options = {}) {
  // Fall back to direct send if queue not initialized
  if (!initialized || !queue) {
    logger.debug('[EmailQueue] Queue not available, sending directly')
    return Email.send(emailData)
  }

  return queue.add(
    'transactional',
    { type: 'transactional', data: emailData },
    {
      attempts: options.attempts || 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      delay: options.delay,
      priority: options.priority,
    }
  )
}

/**
 * Queue a verification email
 * 
 * @param {Object} data - Verification email data
 * @param {string} data.to - Recipient email
 * @param {string} data.name - Recipient name
 * @param {string} data.token - Verification token
 * @param {Object} options - Queue options
 * @returns {Promise<Object>} Job object
 */
async function queueVerificationEmail(data, options = {}) {
  if (!initialized || !queue) {
    return Email.sendVerificationEmail(data)
  }

  return queue.add(
    'verification',
    { type: 'verification', data },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      ...options,
    }
  )
}

/**
 * Queue a password reset email
 * 
 * @param {Object} data - Password reset email data
 * @param {string} data.to - Recipient email
 * @param {string} data.name - Recipient name
 * @param {string} data.resetToken - Reset token
 * @param {Object} options - Queue options
 * @returns {Promise<Object>} Job object
 */
async function queuePasswordResetEmail(data, options = {}) {
  if (!initialized || !queue) {
    return Email.sendPasswordResetEmail(data)
  }

  return queue.add(
    'passwordReset',
    { type: 'passwordReset', data },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      ...options,
    }
  )
}

/**
 * Queue a magic link email
 * 
 * @param {Object} data - Magic link email data
 * @param {Object} options - Queue options
 * @returns {Promise<Object>} Job object
 */
async function queueMagicLinkEmail(data, options = {}) {
  if (!initialized || !queue) {
    return Email.sendMagicLinkEmail(data)
  }

  return queue.add(
    'magicLink',
    { type: 'magicLink', data },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      ...options,
    }
  )
}

/**
 * Queue a bulk email send
 * 
 * @param {Object} data - Bulk email data
 * @param {Array} data.recipients - Array of recipient objects
 * @param {string} data.subject - Email subject
 * @param {string} data.html - HTML content
 * @param {string} data.text - Plain text content
 * @param {Object} options - Queue options
 * @returns {Promise<Object>} Job object
 */
async function queueBulkEmail(data, options = {}) {
  if (!initialized || !queue) {
    throw new Error('Email queue not available - bulk send requires Redis')
  }

  // Split into batches of 100
  const batchSize = 100
  const jobs = []

  for (let i = 0; i < data.recipients.length; i += batchSize) {
    const batch = data.recipients.slice(i, i + batchSize)
    
    const job = await queue.add(
      'bulk',
      {
        type: 'bulk',
        data: {
          ...data,
          recipients: batch,
        },
      },
      {
        attempts: 2, // Less retries for bulk
        backoff: { type: 'exponential', delay: 5000 },
        ...options,
      }
    )

    jobs.push(job)
  }

  return jobs
}

/**
 * Get queue status and metrics
 * 
 * @returns {Promise<Object>} Queue metrics
 */
async function getQueueStatus() {
  if (!initialized || !queue) {
    return { enabled: false }
  }

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ])

  return {
    enabled: true,
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  }
}

/**
 * Clean completed/failed jobs
 * 
 * @param {number} gracePeriod - Keep jobs completed in last X milliseconds (default: 1 day)
 * @returns {Promise<void>}
 */
async function cleanQueue(gracePeriod = 24 * 60 * 60 * 1000) {
  if (!initialized || !queue) {
    return
  }

  await queue.clean(gracePeriod, 1000, 'completed')
  await queue.clean(gracePeriod, 1000, 'failed')

  logger.info({ gracePeriod }, '[EmailQueue] Queue cleaned')
}

/**
 * Close queue and worker connections
 * 
 * @returns {Promise<void>}
 */
async function close() {
  if (!initialized) {
    return
  }

  try {
    if (worker) {
      await worker.close()
    }
    if (scheduler) {
      await scheduler.close()
    }
    if (queue) {
      await queue.close()
    }

    initialized = false
    logger.info('[EmailQueue] Connections closed')
  } catch (err) {
    logger.error({ err }, '[EmailQueue] Error closing connections')
  }
}

/**
 * Parse Redis URL into BullMQ connection config
 * 
 * @param {string} url - Redis URL
 * @returns {Object} Connection config
 */
function parseRedisUrl(url) {
  const urlObj = new URL(url)
  
  return {
    host: urlObj.hostname,
    port: parseInt(urlObj.port) || 6379,
    password: urlObj.password || undefined,
    db: parseInt(urlObj.pathname.slice(1)) || 0,
  }
}

/**
 * Mask sensitive parts of Redis URL for logging
 * 
 * @param {string} url - Redis URL
 * @returns {string} Masked URL
 */
function maskRedisUrl(url) {
  try {
    const urlObj = new URL(url)
    if (urlObj.password) {
      urlObj.password = '***'
    }
    return urlObj.toString()
  } catch {
    return 'redis://***'
  }
}

/**
 * Check if email queue is initialized
 * 
 * @returns {boolean}
 */
function isInitialized() {
  return initialized
}

module.exports = {
  init,
  queueEmail,
  queueVerificationEmail,
  queuePasswordResetEmail,
  queueMagicLinkEmail,
  queueBulkEmail,
  getQueueStatus,
  cleanQueue,
  close,
  isInitialized,
}
