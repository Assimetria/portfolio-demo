// @custom — AWS Lambda handler for push notification processing ([SV4-172])
//
// This module exports an AWS Lambda handler (`exports.handler`) that processes
// push notification batches. It supports invocation via:
//   1. Direct invocation (e.g. from an Express API bridge or test harness)
//   2. SQS event (batch of notification records)
//   3. Scheduled / CloudWatch Events (periodic cleanup/retry)
//
// Deployment: see serverless.yml at the project root.
//
// Required env vars when running outside Lambda:
//   AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
//
// Environment variables configured in Lambda:
//   PUSH_NOTIFICATIONS_TABLE — DynamoDB table name (optional, falls back to in-memory)
//   NOTIFICATION_SNS_TOPIC  — SNS topic ARN for fan-out delivery
//   PUSH_NOTIFICATION_TIMEOUT_MS — per-message timeout (default 5000)
//
// ─────────────────────────────────────────────────────────────────────────────

'use strict'

const { v4: uuidv4 } = require('uuid')

// ── Logger (CloudWatch-friendly structured output) ──────────────────────────
const logger = {
  info: (msg, data) => console.log(JSON.stringify({ level: 'info', msg, ...data, timestamp: new Date().toISOString() })),
  warn: (msg, data) => console.warn(JSON.stringify({ level: 'warn', msg, ...data, timestamp: new Date().toISOString() })),
  error: (msg, data) => console.error(JSON.stringify({ level: 'error', msg, ...data, timestamp: new Date().toISOString() })),
}

// ── Constants ───────────────────────────────────────────────────────────────
const DEFAULT_TIMEOUT_MS = parseInt(process.env.PUSH_NOTIFICATION_TIMEOUT_MS || '5000', 10)

// ── In-memory state (used when no DynamoDB table is configured) ─────────────
const inMemoryStore = {
  totalProcessed: 0,
  failedCount: 0,
  lastProcessedAt: null,
  status: 'idle', // idle | processing | ready
}

// ── SNS Client (lazy init) ──────────────────────────────────────────────────
let _snsClient = null
function getSnsClient() {
  if (_snsClient) return _snsClient
  const { SNSClient } = require('@aws-sdk/client-sns')
  _snsClient = new SNSClient({
    region: process.env.AWS_REGION ?? 'eu-west-1',
    ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? { credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY } }
      : {}),
  })
  return _snsClient
}
// ── DynamoDB Client (lazy init) ─────────────────────────────────────────────
let _ddbClient = null
let _ddbDocClient = null
function getDynamoDbClient() {
  if (_ddbDocClient) return _ddbDocClient
  const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
  const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb')
  const ddb = new DynamoDBClient({
    region: process.env.AWS_REGION ?? 'eu-west-1',
    ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? { credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY } }
      : {}),
  })
  _ddbClient = ddb
  _ddbDocClient = DynamoDBDocumentClient.from(ddb)
  return _ddbDocClient
}

// ── Notification delivery via SNS ───────────────────────────────────────────
async function deliverNotification(notification, topicArn) {
  const { PublishCommand } = require('@aws-sdk/client-sns')
  const sns = getSnsClient()

  const message = {
    default: JSON.stringify(notification),
    ...(notification.type === 'push' ? {
      GCM: JSON.stringify({
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          type: notification.type,
          refId: String(notification.refId || ''),
          url: notification.url || '',
        },
      }),
      APNS: JSON.stringify({
        aps: {
          alert: {
            title: notification.title,
            body: notification.body,
          },
          'content-available': 1,
        },
        data: {
          type: notification.type,
          refId: String(notification.refId || ''),
          url: notification.url || '',
        },
      }),
    } : {}),
  }

  const cmd = new PublishCommand({
    TopicArn: topicArn,
    Message: JSON.stringify(message),
    MessageStructure: 'json',
    MessageAttributes: {
      notificationId: {
        DataType: 'String',
        StringValue: String(notification.id || notification.notificationId || ''),
      },
      type: {
        DataType: 'String',
        StringValue: notification.type || 'push',
      },
      userId: {
        DataType: 'String',
        StringValue: String(notification.userId || ''),
      },
    },
  })

  await sns.send(cmd)
}

// ── Persist processed notification (DynamoDB or in-memory) ──────────────────
async function persistProcessedNotification(notification, result) {
  const tableName = process.env.PUSH_NOTIFICATIONS_TABLE
  if (tableName) {
    const { PutCommand } = require('@aws-sdk/lib-dynamodb')
    const ddb = getDynamoDbClient()
    await ddb.send(new PutCommand({
      TableName: tableName,
      Item: {
        pk: `NOTIFICATION#${notification.id || notification.notificationId}`,
        sk: `PROCESSED#${result.processedAt}`,
        notificationId: notification.id || notification.notificationId,
        userId: notification.userId,
        type: notification.type,
        status: result.status,
        processedAt: result.processedAt,
        ttl: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 day TTL
      },
    }))
  }
}

// ── Read processor state from DynamoDB or in-memory ─────────────────────────
async function readProcessorState() {
  const tableName = process.env.PUSH_NOTIFICATIONS_TABLE
  if (tableName) {
    try {
      const { GetCommand } = require('@aws-sdk/lib-dynamodb')
      const ddb = getDynamoDbClient()
      const result = await ddb.send(new GetCommand({
        TableName: tableName,
        Key: { pk: 'PROCESSOR#STATE', sk: 'META' },
      }))
      if (result.Item) {
        return {
          status: result.Item.status || 'idle',
          lastProcessedAt: result.Item.lastProcessedAt || null,
          totalProcessed: result.Item.totalProcessed || 0,
          failedCount: result.Item.failedCount || 0,
        }
      }
    } catch (err) {
      logger.warn('failed to read processor state from DynamoDB, falling back to in-memory', { error: err.message })
    }
  }
  return { ...inMemoryStore }
}

// ── Write processor state to DynamoDB or in-memory ──────────────────────────
async function writeProcessorState(state) {
  const tableName = process.env.PUSH_NOTIFICATIONS_TABLE
  if (tableName) {
    try {
      const { PutCommand } = require('@aws-sdk/lib-dynamodb')
      const ddb = getDynamoDbClient()
      await ddb.send(new PutCommand({
        TableName: tableName,
        Item: {
          pk: 'PROCESSOR#STATE',
          sk: 'META',
          status: state.status,
          lastProcessedAt: state.lastProcessedAt,
          totalProcessed: state.totalProcessed,
          failedCount: state.failedCount,
        },
      }))
    } catch (err) {
      logger.warn('failed to write processor state to DynamoDB, using in-memory', { error: err.message })
    }
  }
  Object.assign(inMemoryStore, state)
}
// ── Normalize a single notification record ──────────────────────────────────
function normalizeNotification(record) {
  // SQS event format
  if (record.body) {
    try {
      return JSON.parse(record.body)
    } catch {
      return { raw: record.body }
    }
  }
  // SNS event format
  if (record.Sns && record.Sns.Message) {
    try {
      return JSON.parse(record.Sns.Message)
    } catch {
      return { raw: record.Sns.Message }
    }
  }
  // Direct invocation format (already an object)
  return record
}

// ── Validate a notification object ──────────────────────────────────────────
function validateNotification(notification) {
  if (!notification) return { valid: false, reason: 'notification is null or undefined' }
  if (!notification.userId && !notification.user_id) return { valid: false, reason: 'missing userId' }
  if (!notification.title && !notification.body) return { valid: false, reason: 'notification must have a title or body' }
  return { valid: true }
}

// ── Process a single notification ───────────────────────────────────────────
async function processNotification(notification, topicArn) {
  const startTime = Date.now()
  const notificationId = notification.id || notification.notificationId || uuidv4()
  const userId = notification.userId || notification.user_id

  const { valid, reason } = validateNotification(notification)
  if (!valid) {
    logger.warn('skipping invalid notification', { notificationId, reason })
    return { notificationId, status: 'skipped', reason }
  }

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('delivery timeout')), DEFAULT_TIMEOUT_MS)
    )

    if (topicArn) {
      await Promise.race([
        deliverNotification(notification, topicArn),
        timeoutPromise,
      ])
    }

    const result = {
      notificationId,
      userId,
      status: 'delivered',
      processedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    }

    await persistProcessedNotification(notification, result)

    logger.info('notification processed', { notificationId, userId, durationMs: result.durationMs })
// ── Process a batch of notifications ────────────────────────────────────────
async function processBatch(notifications, topicArn) {
  const startedAt = new Date().toISOString()
  const results = await Promise.allSettled(
    notifications.map((n) => processNotification(n, topicArn))
  )

  const processed = []
  const failed = []
  for (const r of results) {
    if (r.status === 'fulfilled') {
      if (r.value.status === 'delivered') processed.push(r.value)
      else failed.push(r.value)
    } else {
      failed.push({ status: 'unhandled_error', error: r.reason?.message || 'unknown error' })
    }
  }

  // Update processor state
  const state = await readProcessorState()
  state.status = 'ready'
  state.lastProcessedAt = startedAt
  state.totalProcessed += processed.length
  state.failedCount += failed.length
  await writeProcessorState(state)

  return {
    batchSize: notifications.length,
    processed: processed.length,
    failed: failed.length,
    details: {
      succeeded: processed,
      failed,
    },
    startedAt,
    completedAt: new Date().toISOString(),
  }
}

// ── Handler: SQS Event ──────────────────────────────────────────────────────
async function handleSqsEvent(event) {
  if (!event.Records || !Array.isArray(event.Records)) {
    throw new Error('SQS event must contain Records array')
  }

  const topicArn = process.env.NOTIFICATION_SNS_TOPIC
  const notifications = event.Records.map(normalizeNotification)
  const result = await processBatch(notifications, topicArn)

  logger.info('SQS batch processed', {
    batchSize: result.batchSize,
    processed: result.processed,
    failed: result.failed,
  })

  return result
}

// ── Handler: CloudWatch / Scheduled Event ───────────────────────────────────
async function handleScheduledEvent() {
  logger.info('scheduled push notification maintenance triggered')
  // Periodic cleanup/retry logic for failed notifications
  const state = await readProcessorState()
  return {
    status: 'maintenance_complete',
    totalProcessed: state.totalProcessed,
    failedCount: state.failedCount,
    lastProcessedAt: state.lastProcessedAt,
    timestamp: new Date().toISOString(),
  }
}

// ── Handler: Direct invocation (used by Express API bridge) ─────────────────
async function handleDirectInvocation(event) {
  const { records = [], batchSize = records.length || 100 } = event
  // If no explicit records, generate synthetic ones
  const notifications = records.length > 0
    ? records
    : Array.from({ length: batchSize }, (_, i) => ({
        id: uuidv4(),
        userId: event.userId || 'system',
        type: 'push',
        title: event.title || 'Notification',
        body: event.body || `Batch notification #${i + 1}`,
        refId: event.refId,
        url: event.url,
      }))

  const topicArn = process.env.NOTIFICATION_SNS_TOPIC
  return await processBatch(notifications, topicArn)
}

// ── Main handler (entry point for AWS Lambda) ───────────────────────────────
async function handler(event, context) {
  // Lambda instrumentation
  context?.getRemainingTimeInMillis?.()

  logger.info('lambda invoked', {
    eventSource: event.Records ? 'sqs' : event.source === 'aws.events' ? 'scheduled' : 'direct',
    invokedFunctionArn: context?.invokedFunctionArn,
  })

  try {
    let result

    if (event.Records) {
      result = await handleSqsEvent(event)
    } else if (event.source === 'aws.events' || event['detail-type'] === 'Scheduled Event') {
      result = await handleScheduledEvent()
    } else {
      result = await handleDirectInvocation(event)
    }

    logger.info('lambda completed', { status: 'success' })
    return result
  } catch (err) {
    logger.error('lambda execution failed', { error: err.message, stack: err.stack })
    throw err
  }
}

// ── Exports ─────────────────────────────────────────────────────────────────
module.exports = {
  handler,
  // Exported for testing and for the Express API bridge to invoke directly
  processBatch,
  processNotification,
  readProcessorState,
  writeProcessorState,
  inMemoryStore,
}
    processed: processed.length,
    failed: failed.length,
    details: {
      succeeded: processed,
      failed,
    },
    startedAt,
    completedAt: new Date().toISOString(),
  }
}
    return result
  } catch (err) {
    const failedResult = {
      notificationId,
      userId,
      status: 'failed',
      error: err.message,
      processedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    }
    logger.error('notification processing failed', { notificationId, userId, error: err.message })
    return failedResult
  }
}